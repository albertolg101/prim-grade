from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

_factory: sessionmaker[Session] | None = None


def init(url: str) -> None:
    global _factory
    _factory = sessionmaker(create_engine(url, pool_pre_ping=True), expire_on_commit=False)


def session() -> Session:
    if _factory is None:
        raise RuntimeError("database not initialised")
    return _factory()


def get_db() -> Iterator[Session]:
    with session() as db:
        yield db
