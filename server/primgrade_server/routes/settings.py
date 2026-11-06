"""PL-06–08, PL-37, PL-61: the teacher's OpenAI key, theme, language, upload-link lifetime and
export format."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..deps import Config, Db, Teacher
from ..security import encrypt

router = APIRouter(prefix="/api/settings", tags=["settings"])


class Prefs(BaseModel):
    """Only the fields sent are changed (the top bar sends theme or language alone)."""
    theme: Literal["system", "light", "dark"] | None = None
    language: Literal["en", "es", "ru"] | None = None
    link_minutes: int | None = Field(default=None, ge=1, le=240)
    export_format: Literal["csv", "xlsx"] | None = None


class ApiKey(BaseModel):
    api_key: str = Field(min_length=20, max_length=300)


def out(user) -> dict:
    # the key itself never leaves the server (PL-06, AC-P03)
    return {"theme": user.theme, "language": user.language, "link_minutes": user.link_minutes,
            "export_format": user.export_format,
            "has_api_key": bool(user.api_key_enc), "api_key_last4": user.api_key_last4}


@router.get("")
def get_settings(user: Teacher) -> dict:
    return out(user)


@router.put("")
def put_settings(body: Prefs, user: Teacher, db: Db) -> dict:
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    return out(user)


@router.put("/api-key")
def put_key(body: ApiKey, user: Teacher, db: Db, config: Config) -> dict:
    key = body.api_key.strip()
    user.api_key_enc, user.api_key_last4 = encrypt(config.secret_key, key), key[-4:]
    db.commit()
    return out(user)


@router.delete("/api-key")
def delete_key(user: Teacher, db: Db) -> dict:
    user.api_key_enc = user.api_key_last4 = None
    db.commit()
    return out(user)
