"""Passwords, session and student cookies, and API-key encryption (PL-04, PL-06, PL-35)."""

import base64
import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from cryptography.fernet import Fernet

SESSION_COOKIE = "pg_session"
STUDENT_COOKIE = "pg_student"
SESSION_DAYS = 14
STUDENT_COOKIE_DAYS = 180  # decisions log, PL-35

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _fernet(secret_key: str) -> Fernet:
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret_key.encode()).digest()))


def encrypt(secret_key: str, value: str) -> str:
    return _fernet(secret_key).encrypt(value.encode()).decode()


def decrypt(secret_key: str, value: str) -> str:
    return _fernet(secret_key).decrypt(value.encode()).decode()
