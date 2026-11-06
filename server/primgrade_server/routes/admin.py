"""PL-03, PL-05: approve, reject, deactivate, grant admin; spending per teacher."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select

from .. import models
from ..deps import Admin, Db

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users")
def users(db: Db, _: Admin) -> list[dict]:
    rows = db.scalars(select(models.User).order_by(models.User.created_at)).all()
    return [{"id": u.id, "email": u.email, "name": u.name, "status": u.status,
             "is_admin": u.is_admin, "created_at": u.created_at.isoformat()} for u in rows]


class StatusChange(BaseModel):
    status: Literal["approved", "rejected", "deactivated"]


class AdminChange(BaseModel):
    is_admin: bool


def _other_active_admins(db, user_id: str) -> int:
    return db.scalar(select(func.count()).select_from(models.User).where(
        models.User.is_admin, models.User.status == "approved", models.User.id != user_id))


@router.post("/users/{user_id}/status")
def set_status(user_id: str, body: StatusChange, db: Db, _: Admin) -> dict:
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(404, "user not found")
    if user.is_admin and body.status != "approved" and _other_active_admins(db, user.id) == 0:
        raise HTTPException(409, "the last admin cannot be deactivated")
    user.status = body.status
    if body.status != "approved":
        db.execute(models.Session.__table__.delete().where(models.Session.user_id == user.id))
    db.commit()
    return {"id": user.id, "status": user.status, "is_admin": user.is_admin}


@router.post("/users/{user_id}/admin")
def set_admin(user_id: str, body: AdminChange, db: Db, _: Admin) -> dict:
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(404, "user not found")
    if body.is_admin and user.status != "approved":
        raise HTTPException(409, "approve the account before making it admin")
    if not body.is_admin and user.is_admin and _other_active_admins(db, user.id) == 0:
        raise HTTPException(409, "the last admin cannot lose admin rights")
    user.is_admin = body.is_admin
    db.commit()
    return {"id": user.id, "status": user.status, "is_admin": user.is_admin}


@router.get("/usage")
def usage(db: Db, _: Admin) -> list[dict]:
    """Tokens and US$ per teacher, in total and per month. Never includes API keys."""
    month = func.to_char(models.AiCall.created_at, "YYYY-MM")
    rows = db.execute(
        select(models.User.id, models.User.name, models.User.email, month,
               func.sum(models.AiCall.total_tokens), func.sum(models.AiCall.cost_usd),
               func.count(models.AiCall.id))
        .join(models.AiCall, models.AiCall.user_id == models.User.id)
        .group_by(models.User.id, models.User.name, models.User.email, month)
        .order_by(models.User.name, month)
    ).all()
    out: dict[str, dict] = {}
    for uid, name, email, m, tokens, usd, calls in rows:
        t = out.setdefault(uid, {"user_id": uid, "name": name, "email": email, "tokens": 0,
                                 "usd": 0.0, "calls": 0, "months": []})
        t["tokens"] += tokens or 0
        t["usd"] += usd or 0.0
        t["calls"] += calls
        t["months"].append({"month": m, "tokens": tokens or 0, "usd": usd or 0.0, "calls": calls})
    return list(out.values())
