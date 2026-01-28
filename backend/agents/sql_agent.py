import os
import re
import asyncio
from typing import List, Dict, Any, Optional
from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits import create_sql_agent
from langchain_google_genai import ChatGoogleGenerativeAI
from backend.config import settings
from backend.utils.query_cleaner import SQLQueryCleaner

class SQLQueryAgent:
    """
    Sub-agent responsible for generating and executing SQL queries.
    """
    
    def __init__(self, db_uri: str, gemini_api_key: str):
        self.db_uri = db_uri
        # Initialize LangChain SQL database
        self.db = SQLDatabase.from_uri(db_uri)
        
        # Initialize Gemini LLM
        self.llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=gemini_api_key,
            temperature=0.1
        )
        
        # Create SQL agent
        self.agent_executor = create_sql_agent(
            llm=self.llm,
            db=self.db,
            agent_type="openai-tools",
            verbose=True,
            handle_parsing_errors=True
        )
        
        self.cleaner = SQLQueryCleaner(max_limit=settings.MAX_SQL_LIMIT)
    
    async def process(self, user_query: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Process natural language query and return SQL results.
        """
        try:
            # Step 1: Enhance query with context
            enhanced_query = self._enhance_query(user_query, context)
            
            # Step 2: Generate and execute SQL using LangChain
            # Note: create_sql_agent's executor runs the query and returns the final answer.
            # We also want the SQL query for transparency.
            
            # Since create_sql_agent runs the tool, we can extract the SQL from logs or
            # use a simpler chain if we just want SQL. 
            # For now, let's use the agent to get the final answer, 
            # but in a production app we might want to separate generation and execution.
            
            # Custom prompt to ensure it returns the SQL as well or just execute it.
            response = await asyncio.to_thread(self.agent_executor.invoke, {"input": enhanced_query})
            
            # Extract final result
            final_output = response.get("output", "")
            
            # Try to find the SQL that was executed (this is tricky with the default agent)
            # Alternatively, we can run a separate generation call for the SQL UI display.
            sql_query = await self._generate_sql_only(enhanced_query)
            
            # Execute the generated SQL to get structured data
            results = await self._execute_sql(sql_query)
            
            return {
                'success': True,
                'text': final_output,
                'sql_query': sql_query,
                'results': results,
                'summary': self._generate_summary(results)
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'results': []
            }
            
    async def _generate_sql_only(self, query: str) -> str:
        """Generate SQL query only for UI display."""
        prompt = f"""
        Given the following database schema, generate a PostgreSQL SELECT query to answer the user request.
        Schema: work_orders table with columns: work_order_id, service_provider, status, priority, city, region, order_type, customer_type, cost_inr, resolution_time_hrs, sla_met, customer_rating, escalation_count, created_date, completed_date.
        
        User Request: "{query}"
        
        Respond with ONLY the SQL query. No explanations.
        """
        response = await self.llm.ainvoke(prompt)
        return self.cleaner.clean(response.content)

    def _enhance_query(self, query: str, context: Optional[Dict]) -> str:
        if not context:
            return query
        filters = context.get('filters', {})
        if filters:
            query += f" (Filters: {filters})"
        return query

    async def _execute_sql(self, sql: str) -> List[Dict[str, Any]]:
        if not sql:
            return []
        try:
            # Simple validation
            if not sql.strip().upper().startswith("SELECT"):
                return []
                
            return await asyncio.to_thread(self.db.run, sql, fetch="all")
        except Exception as e:
            print(f"SQL Execution Error: {e}")
            return []

    def _generate_summary(self, results: List[Any]) -> Dict[str, Any]:
        # If results is a string (from db.run for some tools), parse it or handle it.
        # LangChain db.run often returns a string representation of the list.
        # We might need to use sqlalchemy directly for better structured data.
        
        if not isinstance(results, list):
            return {"total": 0}
            
        return {
            "total": len(results),
            "columns": results[0].keys() if results and isinstance(results[0], dict) else []
        }
