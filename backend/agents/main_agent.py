import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from backend.agents.sql_agent import SQLQueryAgent
from backend.agents.analytics_agent import AnalyticsAgent
from backend.agents.viz_agent import VisualizationAgent
from backend.config import settings

class MainAgent:
    """
    Orchestrator agent that coordinates sub-agents and manages workflow.
    """
    
    def __init__(self):
        # Initialize sub-agents
        self.sql_agent = SQLQueryAgent(
            db_uri=settings.DATABASE_URL,
            gemini_api_key=settings.GEMINI_API_KEY
        )
        self.analytics_agent = AnalyticsAgent()
        self.viz_agent = VisualizationAgent()
        
        # Initialize Gemini for orchestration
        self.llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.3
        )
        
        self.history = []
    
    async def process_message(self, message: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Main entry point for processing user messages.
        """
        # Step 1: Classify intent
        intent = await self._classify_intent(message)
        
        # Step 2: Route to appropriate sub-agent
        result = {'success': False, 'results': []}
        
        if intent['type'] in ['sql_query', 'analytics', 'visualization']:
            result = await self.sql_agent.process(message, context)
            
            if result['success']:
                # Post-processing for analytics
                if intent['type'] == 'analytics':
                    result['summary'] = self.analytics_agent.process(result['results'], intent['parameters'])
                
                # Post-processing for visualization
                if intent['type'] == 'visualization':
                    result['chart'] = self.viz_agent.process(result['results'], intent['parameters'])
        else:
            # General conversation
            result = await self._handle_conversation(message)
        
        # Step 3: Generate natural language response
        response_text = await self._generate_response(message, result, intent)
        
        # Step 4: Generate follow-up suggestions
        suggestions = self._generate_suggestions(intent, result)
        
        return {
            'text': response_text,
            'data': result.get('results', []),
            'chart': result.get('chart'),
            'summary': result.get('summary', {}),
            'sql_query': result.get('sql_query'),
            'suggestions': suggestions,
            'metadata': {
                'intent': intent,
                'timestamp': datetime.utcnow().isoformat()
            }
        }
    
    async def _classify_intent(self, message: str) -> Dict[str, Any]:
        prompt = f"""Classify this user query into one of these intents:
        1. sql_query: User wants specific data.
        2. analytics: User wants metrics/aggregations.
        3. visualization: User wants a chart.
        4. conversation: General chat or help.

        User query: "{message}"

        Extract parameters like: provider, status, priority, city, aggregation, chart_type.
        Respond in JSON format only.
        """
        response = await self.llm.ainvoke(prompt)
        try:
            # Basic JSON extraction from markdown if needed
            content = response.content
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            return json.loads(content)
        except:
            return {"type": "conversation", "confidence": 0.5, "parameters": {}}

    async def _handle_conversation(self, message: str) -> Dict[str, Any]:
        return {
            'success': True,
            'results': [],
            'text': f"Conversation mode: {message}"
        }

    async def _generate_response(self, user_message: str, result: Dict, intent: Dict) -> str:
        if not result.get('success', False):
            return f"❌ I encountered an error: {result.get('error', 'Unknown error')}"
        
        if intent['type'] == 'conversation':
             return result.get('text', "")

        prompt = f"""
        Generate a conversational response for the user's request.
        User said: "{user_message}"
        Data results: {len(result.get('results', []))} records found.
        Summary metrics: {json.dumps(result.get('summary', {}))}
        
        Keep it professional and helpful.
        """
        response = await self.llm.ainvoke(prompt)
        return response.content.strip()
    
    def _generate_suggestions(self, intent: Dict, result: Dict) -> List[str]:
        suggestions = ["Show me the latest orders", "What's the SLA compliance?"]
        if result.get('success') and len(result.get('results', [])) > 0:
            suggestions.insert(0, "Visualize this as a chart")
        return suggestions[:4]
