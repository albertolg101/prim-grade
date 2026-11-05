"""Request dependencies: settings, the database session and the signed-in teacher."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .config import Settings
from .db import get_db
from .security import SESSION_COOKIE, token_hash

Db = Annotated[Session, Depends(get_db)]


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


Config = Annotated[Settings, Depends(get_settings)]


def current_user(request: Request, db: Db) -> models.User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(401, "sign in first")
    row = db.execute(
        select(models.Session, models.User)
        .join(models.User, models.User.id == models.Session.user_id)
        .where(models.Session.token_hash == token_hash(token))
    ).first()
    if row is None or row[0].expires_at < datetime.now(UTC):
        raise HTTPException(401, "your session has ended; sign in again")
    if row[1].status != "approved":
        raise HTTPException(403, "your account is not active")
    return row[1]


Teacher = Annotated[models.User, Depends(current_user)]


def admin_user(user: Teacher) -> models.User:
    if not user.is_admin:
        raise HTTPException(403, "admins only")
    return user


Admin = Annotated[models.User, Depends(admin_user)]


def owned[T](db: Session, model: type[T], id_: str, user: models.User) -> T:
    """Load a row the teacher owns; someone else's row is reported as not found."""
    row = db.get(model, id_)
    if row is None or getattr(row, "owner_id", None) != user.id:
        raise HTTPException(404, f"{model.__name__.lower()} not found")
    return row
