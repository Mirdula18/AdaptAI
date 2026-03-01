import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "acadex-secret-key")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "acadex-jwt-secret")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///acadex.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    _raw_upload = os.getenv("UPLOAD_FOLDER", "uploads")
    UPLOAD_FOLDER = (
        _raw_upload
        if os.path.isabs(_raw_upload)
        else os.path.join(os.path.dirname(os.path.abspath(__file__)), _raw_upload)
    )
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 52428800))  # 50MB

    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")
    LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434")
    LLM_MODEL = os.getenv("LLM_MODEL", "gemma:2b")

    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    LICENSE_KEY = os.getenv("LICENSE_KEY", "ACADEX-DEMO-2026")

    # SMTP Configuration (leave empty for offline mode)
    SMTP_HOST = os.getenv("SMTP_SERVER", os.getenv("SMTP_HOST", ""))
    SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
    SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "noreply@acadex.local")
    SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "AdaptIQ Platform")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}
