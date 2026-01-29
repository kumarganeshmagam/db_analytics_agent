import os
import re
import asyncio
from typing import List, Dict, Any, Optional
from langchain_community.utilities import SQLDatabase
from langchain_community.chat_models import ChatOllama
from langchain.schema.output_parser import StrOutputParser
from langchain.schema.runnable import RunnablePassthrough
from sqlalchemy import create_engine, text as sql_text
from langchain.prompts import PromptTemplate
from config import settings

class SQLQueryAgent:
    """
    Specialized agent for SQL query generation and execution with pagination.
    """
    ALLOWED_TABLES = {"work_orders"}

    def __init__(self, db_uri: str):
        self.db_uri = db_uri
        self.db = SQLDatabase.from_uri(db_uri, include_tables=["work_orders"])
        self.engine = create_engine(db_uri)
        
        self.llm = ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            temperature=0.0
        )
        
        self.sql_generation_chain = self._create_sql_generation_chain()

    def _create_sql_generation_chain(self):
        """Creates a chain for SQL query generation."""
        template = """
You are a SQL expert. Generate a syntactically correct PostgreSQL query based on the schema and user question.

**Rules**:
1. Return ONLY the SQL query, no explanations
2. Do NOT include LIMIT or OFFSET clauses (they will be added automatically)
3. Use proper PostgreSQL syntax
4. Handle filters, sorting, and aggregations as requested
5. For geographical filters (south, north, etc.), use LIKE or ILIKE on city column

**Schema**:
{schema}

**User Question**:
{question}

**SQL Query** (no markdown, no explanations):
"""
        prompt = PromptTemplate(
            input_variables=["question", "schema"],
            template=template,
        )

        return (
            {"schema": lambda x: self.db.get_table_info(), "question": RunnablePassthrough()}
            | prompt
            | self.llm
            | StrOutputParser()
        )

    async def process(self, user_query: str, context: Optional[Dict] = None, 
                     limit: int = None, offset: int = 0) -> Dict[str, Any]:
        """
        Generates and executes SQL query with pagination support.
        """
        if limit is None:
            limit = settings.DEFAULT_PAGE_SIZE
        limit = min(max(int(limit), 1), settings.MAX_SQL_LIMIT)
        offset = max(int(offset), 0)
            
        try:
            # Generate SQL query
            generated_sql = await self.sql_generation_chain.ainvoke(user_query)
            
            # Clean the SQL
            cleaned_sql = self._clean_sql(generated_sql)

            # Guardrails: SELECT-only and allowed tables
            if not self._validate_sql(cleaned_sql):
                return {
                    'success': False,
                    'error': 'Query blocked by safety rules',
                    'results': [],
                    'total_count': 0
                }
            
            # Add pagination
            paginated_sql = self._add_pagination(cleaned_sql, limit, offset)
            
            # Get total count (for pagination metadata)
            total_count = await self._get_total_count(cleaned_sql)
            
            # Execute paginated query
            with self.engine.connect() as connection:
                result = connection.execute(sql_text(paginated_sql))
                rows = result.fetchall()
                columns = result.keys()
                
                # Convert to list of dictionaries
                results_list = [dict(zip(columns, row)) for row in rows]

            return {
                'success': True,
                'sql_query': paginated_sql,
                'results': results_list,
                'total_count': total_count,
                'summary': self._generate_summary(results_list, total_count)
            }

        except Exception as e:
            # Don't expose internal errors to user
            return {
                'success': False,
                'error': 'Query execution failed',
                'results': [],
                'total_count': 0
            }

    def _clean_sql(self, sql_query: str) -> str:
        """Remove markdown and extract pure SQL."""
        # Remove markdown code blocks
        cleaned = re.sub(r"```(sql)?", "", sql_query, flags=re.IGNORECASE)
        
        # Extract SELECT statement
        select_match = re.search(r"SELECT", cleaned, re.IGNORECASE)
        if select_match:
            cleaned = cleaned[select_match.start():]
        
        # Remove any existing LIMIT/OFFSET
        cleaned = re.sub(r'\s*LIMIT\s+\d+', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\s*OFFSET\s+\d+', '', cleaned, flags=re.IGNORECASE)
        
        return cleaned.strip().rstrip(';')

    def _add_pagination(self, sql: str, limit: int, offset: int) -> str:
        """Add LIMIT and OFFSET to SQL query."""
        return f"{sql} LIMIT {limit} OFFSET {offset};"

    async def _get_total_count(self, sql: str) -> int:
        """Get total count of records without pagination."""
        try:
            # Convert SELECT query to COUNT query
            count_sql = f"SELECT COUNT(*) as total FROM ({sql}) as subquery;"
            
            with self.engine.connect() as connection:
                result = connection.execute(sql_text(count_sql))
                row = result.fetchone()
                return row[0] if row else 0
                
        except:
            return 0

    def _generate_summary(self, results: List[Dict], total_count: int) -> Dict[str, Any]:
        """Generate summary information."""
        if not results:
            return {"total_count": 0, "returned": 0, "columns": []}
            
        return {
            "total_count": total_count,
            "returned": len(results),
            "columns": list(results[0].keys()) if results else []
        }

    def _validate_sql(self, sql: str) -> bool:
        """Block non-SELECT statements and non-whitelisted tables."""
        if not sql:
            return False
        normalized = sql.strip().rstrip(';')
        lowered = normalized.lower()
        if not (lowered.startswith('select') or lowered.startswith('with')):
            return False

        # Block non-select keywords defensively
        forbidden = ['insert', 'update', 'delete', 'drop', 'alter', 'truncate', 'create']
        if any(re.search(rf'\b{kw}\b', normalized, flags=re.IGNORECASE) for kw in forbidden):
            return False

        tables = self._extract_table_names(normalized)
        if not tables:
            allowed = next(iter(self.ALLOWED_TABLES))
            return re.search(rf'\b{re.escape(allowed)}\b', normalized, flags=re.IGNORECASE) is not None
        return all(table in self.ALLOWED_TABLES for table in tables)

    def _extract_table_names(self, sql: str) -> List[str]:
        """Extract table names from FROM/JOIN clauses."""
        pattern = r'\b(from|join)\s+(["\w\.]+)'
        tables = []
        for match in re.finditer(pattern, sql, flags=re.IGNORECASE):
            raw = match.group(2)
            raw = raw.strip('\"')
            table = raw.split('.')[-1]
            tables.append(table)
        return tables
