import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Power BI Query Assistant API"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://admin:admin123@localhost:5432/workorders")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    
    # SQL Settings - Pagination
    DEFAULT_PAGE_SIZE: int = 10  # Default preview size
    MAX_SQL_LIMIT: int = 1000
    
    # Agent Settings
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
    
    class Config:
        case_sensitive = True

settings = Settings()
