import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Power BI Query Assistant API"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://admin:admin123@localhost:5432/workorders")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    
    # SQL Settings
    MAX_SQL_LIMIT: int = 10000
    
    # Agent Settings
    GEMINI_MODEL: str = "gemini-2.0-flash"
    
    class Config:
        case_sensitive = True

settings = Settings()
