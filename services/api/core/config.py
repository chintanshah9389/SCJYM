from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017/scjygm"

    # JWT
    jwt_secret: str = "change_me_jwt_secret"
    jwt_refresh_secret: str = "change_me_refresh_secret"
    jwt_access_ttl_minutes: int = 60
    jwt_refresh_ttl_days: int = 30
    jwt_algorithm: str = "HS256"

    # Super Admin seed
    super_admin_email: str = "superadmin@example.com"
    super_admin_password: str = "SuperSecureP@ssw0rd!"
    super_admin_full_name: str = "Super Admin"

    # FCM
    fcm_server_key: str = ""

    # Cloudinary
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # Email
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: str = ""
    smtp_pass: str = ""
    email_from: str = "noreply@scjygm.local"

    # App
    app_env: str = "development"
    log_level: str = "debug"
    api_base_url: str = "http://localhost:8000/api/v1"
    mobile_deep_link_scheme: str = "scjygm"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
