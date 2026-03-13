import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # Server
    host: str = os.getenv("BACKEND_HOST", "127.0.0.1")
    port: int = int(os.getenv("BACKEND_PORT", "3001"))

    # Google
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    google_client_secret: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    google_refresh_token: str = os.getenv("GOOGLE_REFRESH_TOKEN", "")

    # Anthropic
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")

    # Database
    db_path: str = os.getenv("DB_PATH", "fabric.db")
    chroma_path: str = os.getenv("CHROMA_PATH", "chroma_data")

    # Agent config
    max_task_retries: int = 3
    task_queue_workers: int = 4

settings = Settings()
