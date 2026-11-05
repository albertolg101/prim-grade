"""PL-06–08: the teacher's OpenAI key, theme and default upload-link lifetime."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..deps import Config, Db, Teacher
from ..security import encrypt

router = APIRouter(prefix="/api/settings", tags=["settings"])


class Prefs(BaseModel):
    theme: Literal["system", "light", "dark"]
    link_minutes: int = Field(ge=1, le=240)


class ApiKey(BaseModel):
    api_key: str = Field(min_length=20, max_length=300)


def out(user) -> dict:
    # the key itself never leaves the server (PL-06, AC-P03)
    return {"theme": user.theme, "link_minutes": user.link_minutes,
            "has_api_key": bool(user.api_key_enc), "api_key_last4": user.api_key_last4}


@router.get("")
def get_settings(user: Teacher) -> dict:
    return out(user)


@router.put("")
def put_settings(body: Prefs, user: Teacher, db: Db) -> dict:
    user.theme, user.link_minutes = body.theme, body.link_minutes
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
