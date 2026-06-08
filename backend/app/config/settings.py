class Settings:
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    DATABASE_URL: str = "sqlite:///./app.db"
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 20 * 1024 * 1024
    ALLOWED_EXTENSIONS: list = [".docx", ".pdf"]

settings = Settings()