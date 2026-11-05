"""PL-01, PL-02, PL-04: sign-up with approval, first user is admin, sign-in and sign-out."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text

from .. import models
from ..deps import Config, Db, Teacher
from ..security import (
    SESSION_COOKIE,
    SESSION_DAYS,
    hash_password,
    new_token,
    token_hash,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignUp(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=200)


class SignIn(BaseModel):
    email: str
    password: str


def user_out(u: models.User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "status": u.status,
            "is_admin": u.is_admin, "theme": u.theme}


def _email(raw: str) -> str:
    email = raw.strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(422, "enter a valid email address")
    return email


@router.post("/signup", status_code=201)
def signup(body: SignUp, db: Db) -> dict:
    email = _email(body.email)
    db.execute(text("SELECT pg_advisory_xact_lock(4201)"))  # one first-admin, even if concurrent
    if db.scalar(select(models.User).where(models.User.email == email)):
        raise HTTPException(409, "an account with this email already exists")
    first = db.scalar(select(func.count()).select_from(models.User)) == 0
    user = models.User(email=email, name=body.name.strip(),
                       password_hash=hash_password(body.password),
                       status="approved" if first else "pending", is_admin=first)
    db.add(user)
    db.commit()
    return {**user_out(user), "message": "You are the admin." if first else
            "Your account is waiting for an admin's approval."}


@router.post("/login")
def login(body: SignIn, db: Db, response: Response, config: Config) -> dict:
    user = db.scalar(select(models.User).where(models.User.email == body.email.strip().lower()))
    if user is None or not verify_password(user.password_hash, body.password):
        raise HTTPException(401, "wrong email or password")
    if user.status == "pending":
        raise HTTPException(403, "your account is waiting for an admin's approval")
    if user.status != "approved":
        raise HTTPException(403, "your account is not active; contact an admin")
    token = new_token()
    db.add(models.Session(token_hash=token_hash(token), user_id=user.id,
                          expires_at=datetime.now(UTC) + timedelta(days=SESSION_DAYS)))
    db.commit()
    response.set_cookie(SESSION_COOKIE, token, max_age=SESSION_DAYS * 86400, httponly=True,
                        samesite="lax", secure=config.secure_cookies, path="/")
    return user_out(user)


@router.post("/logout")
def logout(request: Request, db: Db, response: Response) -> dict:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        row = db.get(models.Session, token_hash(token))
        if row:
            db.delete(row)
            db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: Teacher, config: Config) -> dict:
    return {**user_out(user), "fake_llm": config.llm == "fake"}
