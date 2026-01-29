import json
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from langchain_community.chat_models import ChatOllama
from agents.sql_agent import SQLQueryAgent
from agents.analytics_agent import AnalyticsAgent
from agents.viz_agent import VisualizationAgent
from config import settings

class MainAgent:
    """
    Orchestrator agent that coordinates sub-agents and manages workflow.
    """
    ROUTER_SYSTEM_PROMPT = """
You are the routing brain for a Power BI Query Assistant. You MUST return a single valid JSON object and nothing else.

You can choose one of these actions:
- "execute": Run a SQL/analytics/visualization query now.
- "ask_clarification": Ask a follow-up question because required details are missing.
- "paginate": User is asking for more results from the last query.
- "conversation": General chat / not a data task.

You can choose one of these types:
- "sql_query": retrieve rows from the database
- "analytics": aggregate/metric/summary
- "visualization": charting request
- "conversation"

Available helper capabilities (you do NOT call them directly; you choose the action/type):
- SQL execution
- Analytics summary over SQL results
- Visualization generation from SQL results
- Follow-up questions for missing values
- Pagination using previous query context

Critical rules:
1) Never invent filter values. If a filter is requested without a value, ask a follow-up.
2) If user says "filter by <field>" with no value, ask for the value.
3) If user says "show orders by <field>" and no value is given, interpret as grouping/aggregation by that field.
4) If user says "show more", "next page", "more results", use "paginate".
5) If the user says "visualize this data" or "show analytics summary" and there is a last query, reuse it.
6) If the user asks for "all orders"/"all data"/"everything", execute without filters.
7) If unsure, ask a clarification question.
8) If the user asks for data without filters and does NOT explicitly request all data, ask the filter question.
9) If a work order ID like "WO-001223" is present, set filters.work_order_id and execute without asking for filters.
10) Never respond with "conversation" for messages that clearly request data (e.g., contain "show", "list", "get", "find" + "orders/work orders"). Use "execute" or "ask_clarification" instead.

Known pitfalls (use these as examples of correct behavior):
- "Show me all orders" -> execute (no filters).
- "Show all orders" -> execute (no filters).
- "Show work orders" (no filters) -> ask the filter question, not conversation.
- "Filter by status" -> ask: "Which status? (Completed, Pending, In Progress, Cancelled, Escalated)"
- "Filter by city" -> ask: "Which city?"
- "Show orders by provider" -> group by provider (aggregation), do NOT use provider LIKE '%' filter.
- "Show me analytics summary" with no filters -> execute analytics on all data (or ask to confirm if dataset is large).
- "Show more" -> paginate the last successful query.
- "What is the status of work order WO-001223" -> execute with filters.work_order_id = "WO-001223".

Return JSON with this schema:
{
  "action": "execute|ask_clarification|paginate|conversation",
  "type": "sql_query|analytics|visualization|conversation",
  "parameters": {
    "filters": { "work_order_id": "...", "provider": "...", "status": "...", "priority": "...", "city": "...", "date_range": "..." },
    "group_by": ["..."],
    "aggregation": "count|sum|avg|min|max|total|none",
    "chart_type": "bar|line|pie|scatter|none",
    "sort": { "field": "...", "direction": "ASC|DESC" }
  },
  "normalized_query": "short natural-language query to send to SQL generator",
  "clarification_question": "only if action=ask_clarification",
  "missing_fields": ["field1", "field2"],
  "use_last_query": true|false,
  "confidence": 0.0-1.0
}
""".strip()
    
    def __init__(self):
        # Initialize sub-agents
        self.sql_agent = SQLQueryAgent(
            db_uri=settings.DATABASE_URL
        )
        self.analytics_agent = AnalyticsAgent()
        self.viz_agent = VisualizationAgent()

        # Initialize Ollama for orchestration
        self.llm = ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            temperature=0.3
        )

        self.history = []
        self.state = {
            'status': None,
            'last_query_message': None,
            'last_intent': None,
            'last_page': 1,
            'page_size': settings.DEFAULT_PAGE_SIZE,
            'clarification_count': 0
        }

    async def process_message(self, message: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Main entry point for processing user messages.
        Enhanced with better filter detection and pagination support.
        """
        try:
            # Merge clarification follow-up into original message
            if self.state.get('status') == 'awaiting_clarification':
                original = self.state.get('original_message', '')
                message = f"{original} {message}".strip()
                self.state['status'] = None
                self.state['original_message'] = None

            # Extract pagination info from context or state
            page_size = context.get('page_size', settings.DEFAULT_PAGE_SIZE) if context else self.state.get('page_size', settings.DEFAULT_PAGE_SIZE)
            explicit_all = self._is_explicit_all_request(message)

            # Route with LLM (full LLM-only routing)
            routing = await self._route_with_llm(message, context)
            action = routing.get('action', 'conversation')
            intent_type = routing.get('type', 'conversation')

            if action == 'ask_clarification':
                if self.state.get('clarification_count', 0) >= 2:
                    return self._ask_for_clarification({
                        'clarification_question': "Please provide specific filter values or say 'all data' to proceed.",
                        'missing_fields': ['filters']
                    })
                self.state['status'] = 'awaiting_clarification'
                self.state['original_message'] = message
                self.state['clarification_count'] = self.state.get('clarification_count', 0) + 1
                return self._ask_for_clarification(routing)

            if action == 'paginate':
                last_query = self.state.get('last_query_message')
                last_intent = self.state.get('last_intent')
                if not last_query or not last_intent:
                    return self._ask_for_clarification({
                        'clarification_question': "What should I paginate? Please ask a query first (e.g., 'Show all orders').",
                        'missing_fields': ['query']
                    })
                requested_page = context.get('page') if context else None
                next_page = requested_page or (self.state.get('last_page', 1) + 1)
                offset = (max(next_page, 1) - 1) * page_size
                return await self._execute_query(last_query, last_intent, context, offset, page_size)

            if action == 'execute' and intent_type in ['sql_query', 'analytics', 'visualization']:
                intent = {
                    'type': intent_type,
                    'parameters': routing.get('parameters', {}) or {}
                }
                use_last = routing.get('use_last_query', False)
                if use_last and self.state.get('last_query_message') and self.state.get('last_intent'):
                    intent = self.state['last_intent']
                    query_message = self.state['last_query_message']
                else:
                    query_message = routing.get('normalized_query') or message

                # Guardrail: if no filters and no explicit all-data request, ask clarification
                has_filters = bool(intent.get('parameters', {}).get('filters'))
                if not has_filters and not explicit_all and not use_last:
                    return self._ask_for_clarification({
                        'clarification_question': self._default_filter_question(),
                        'missing_fields': ['filters']
                    })

                offset = 0
                return await self._execute_query(query_message, intent, context, offset, page_size)

            if action == 'conversation' or intent_type == 'conversation':
                result = await self._handle_conversation(message)
                return {
                    'text': result.get('text', ''),
                    'data': [],
                    'chart': None,
                    'summary': {},
                    'sql_query': None,
                    'suggestions': ["Show all orders", "Filter by status", "Show analytics summary"],
                    'metadata': {'intent': 'conversation', 'timestamp': datetime.utcnow().isoformat()}
                }

            # Fallback
            return self._create_error_response("I'm not sure how to process that. Please rephrase your request.")
                
        except Exception as e:
            return self._create_error_response(f"An error occurred: {str(e)}")

    async def _execute_query(self, message: str, intent: Dict[str, Any], 
                            context: Optional[Dict] = None, 
                            offset: int = 0, 
                            page_size: int = None) -> Dict[str, Any]:
        """
        Executes the query and processes the results with pagination support.
        """
        if page_size is None:
            page_size = settings.DEFAULT_PAGE_SIZE
            
        result = {'success': False, 'results': []}

        try:
            if intent['type'] in ['sql_query', 'analytics', 'visualization']:
                # Execute SQL query with pagination
                result = await self.sql_agent.process(message, context, limit=page_size, offset=offset)

                if result['success']:
                    # Update pagination state on success
                    self.state['last_query_message'] = message
                    self.state['last_intent'] = intent
                    self.state['last_page'] = (offset // page_size) + 1
                    self.state['page_size'] = page_size
                    self.state['clarification_count'] = 0

                    # Process analytics if needed
                    if intent['type'] == 'analytics':
                        result['summary'] = self.analytics_agent.process(
                            result['results'], 
                            intent.get('parameters', {})
                        )
                    
                    # Process visualization if needed
                    if intent['type'] == 'visualization':
                        result['chart'] = self.viz_agent.process(
                            result['results'], 
                            intent.get('parameters', {})
                        )
                    
                    # Generate user-friendly response
                    response_text = self._generate_simple_response(result, intent, page_size, offset)
                else:
                    response_text = "I couldn't retrieve the data. Please try rephrasing your question."
                    
            else:
                result = await self._handle_conversation(message)
                response_text = result.get('text', '')

            # Build final response
            suggestions = self._generate_suggestions(intent, result, offset, page_size)
            total_records = result.get('total_count', len(result.get('results', [])))
            current_page = (offset // page_size) + 1
            
            return {
                'text': response_text,
                'data': result.get('results', []),
                'chart': result.get('chart'),
                'summary': result.get('summary', {}),
                'sql_query': result.get('sql_query') if settings.DEBUG else None,  # Only show in debug mode
                'suggestions': suggestions,
                'pagination': {
                    'current_page': current_page,
                    'page_size': page_size,
                    'total_records': total_records,
                    'has_more': total_records > (current_page * page_size)
                },
                'metadata': {
                    'intent': intent['type'],
                    'timestamp': datetime.utcnow().isoformat()
                }
            }
            
        except Exception as e:
            return self._create_error_response(str(e))

    def _generate_simple_response(self, result: Dict, intent: Dict, page_size: int, offset: int) -> str:
        """
        Generates a simple, user-friendly response without exposing internal details.
        """
        if not result.get('success', False):
            return "I couldn't retrieve the data. Please try again or rephrase your question."
        
        results = result.get('results', [])
        total_returned = len(results)
        
        if total_returned == 0:
            return (
                "I couldn't find any orders matching your criteria. "
                "You can try adjusting your filters or ask me to show all orders."
            )
        
        # Calculate pagination info
        current_page = (offset // page_size) + 1
        start_record = offset + 1
        end_record = offset + total_returned
        
        # Build response based on intent type
        if intent['type'] == 'analytics':
            summary = result.get('summary', {})
            if 'total' in summary:
                return f"I found {summary['total']} orders. Showing records {start_record} to {end_record}."
            elif 'count' in summary:
                return f"There are {summary['count']} orders matching your criteria. Showing {total_returned} records."
        
        # Default response
        has_more = total_returned == page_size
        response = f"I found {total_returned} order{'s' if total_returned != 1 else ''} (showing records {start_record} to {end_record})."
        
        if has_more:
            response += " There are more records available. Click 'Show More' to see the next set."
        
        return response

    def _ask_for_clarification(self, routing: Dict[str, Any]) -> Dict[str, Any]:
        """Ask the LLM-selected clarification question."""
        question = routing.get('clarification_question') or self._default_filter_question()
        return {
            'text': question,
            'data': [],
            'chart': None,
            'summary': {},
            'sql_query': None,
            'suggestions': [
                "Show all orders",
                "Filter by status (Completed)",
                "Filter by city (Hyderabad)"
            ],
            'metadata': {'awaiting_input': True}
        }

    def _default_filter_question(self) -> str:
        return (
            "Would you like to retrieve all data, or would you prefer to add filters to narrow down the results?\n\n"
            "Available filters include:\n"
            "- Provider\n"
            "- Time frame (date range)\n"
            "- Status\n"
            "- Priority\n"
            "- City\n\n"
            "You can select one or multiple filters."
        )

    async def _route_with_llm(self, message: str, context: Optional[Dict]) -> Dict[str, Any]:
        """
        LLM-only router that decides action/type/parameters.
        """
        context_payload = {
            "last_query_message": self.state.get('last_query_message'),
            "last_intent": self.state.get('last_intent'),
            "last_page": self.state.get('last_page', 1),
            "page_size": context.get('page_size') if context else self.state.get('page_size', settings.DEFAULT_PAGE_SIZE),
            "explicit_all_request": self._is_explicit_all_request(message),
            "has_work_order_identifier": self._has_work_order_identifier(message),
            "known_statuses": ["Completed", "Pending", "In Progress", "Cancelled", "Escalated"],
            "known_priorities": ["High", "Medium", "Low"],
            "known_filters": ["work_order_id", "provider", "status", "priority", "city", "date_range", "region"]
        }

        prompt = (
            f"{self.ROUTER_SYSTEM_PROMPT}\n\n"
            f"Context (JSON): {json.dumps(context_payload)}\n\n"
            f"User message: \"{message}\"\n\n"
            "Return JSON only."
        )

        try:
            response = await self.llm.ainvoke(prompt)
            content = response.content.strip()
            
            # Extract JSON from response
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                routing = json.loads(match.group(0))
                if 'parameters' not in routing or routing['parameters'] is None:
                    routing['parameters'] = {}
                return routing
            
        except Exception as e:
            return {
                "action": "conversation",
                "type": "conversation",
                "parameters": {},
                "confidence": 0.0
            }

    def _is_explicit_all_request(self, message: str) -> bool:
        if not message:
            return False
        text = message.lower()
        indicators = [
            "all data", "all orders", "everything", "no filters", "no filter",
            "show all", "entire dataset", "full list"
        ]
        return any(indicator in text for indicator in indicators)

    def _has_work_order_identifier(self, message: str) -> bool:
        if not message:
            return False
        return re.search(r'\bWO-\d{6}\b', message, flags=re.IGNORECASE) is not None

    async def _handle_conversation(self, message: str) -> Dict[str, Any]:
        """Handle general conversation."""
        return {
            'success': True,
            'results': [],
            'text': "I'm here to help you query your work orders data. You can ask me to show orders, filter by status, calculate metrics, or create visualizations."
        }

    def _generate_suggestions(self, intent: Dict, result: Dict, offset: int, page_size: int) -> List[str]:
        """Generate contextual suggestions including pagination."""
        suggestions = []
        
        # Add "Show More" if there are more results
        if result.get('success') and len(result.get('results', [])) == page_size:
            suggestions.append("Show More")
        
        # Add contextual suggestions based on current data
        if result.get('success') and result.get('results'):
            suggestions.extend([
                "Visualize this data",
                "Show me analytics summary",
                "Filter by status"
            ])
        else:
            suggestions.extend([
                "Show all orders",
                "Show high priority orders",
                "Show orders by provider"
            ])
        
        return suggestions[:4]

    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        """Create a standardized error response without exposing internals."""
        return {
            'text': "I encountered an issue processing your request. Please try rephrasing your question or contact support if the problem persists.",
            'data': [],
            'chart': None,
            'summary': {},
            'sql_query': None,
            'suggestions': [
                "Show all orders",
                "Try a different query",
                "Get help"
            ],
            'metadata': {
                'error': True,
                'timestamp': datetime.utcnow().isoformat()
            }
        }
