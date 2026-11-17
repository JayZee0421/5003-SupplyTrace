from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str = Field(default='postgresql://localhost/supplytrace', repr=False)
    cors_origins: list[str] = ['http://localhost:3000', 'http://localhost:5173']
    statement_timeout_ms: int = Field(default=15000, ge=100, le=300000)
    pool_size: int = Field(default=5, ge=1, le=50)
