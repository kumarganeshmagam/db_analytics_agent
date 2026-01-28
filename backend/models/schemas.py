from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

class QueryRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None

class QueryResponse(BaseModel):
    text: str
    data: List[Dict[str, Any]] = []
    chart: Optional[Dict[str, Any]] = None
    summary: Dict[str, Any] = {}
    sql_query: Optional[str] = None
    suggestions: List[str] = []
    metadata: Dict[str, Any] = {}

class IntentClassification(BaseModel):
    type: str  # 'sql_query', 'analytics', 'visualization', 'conversation'
    confidence: float
    parameters: Dict[str, Any] = {}
