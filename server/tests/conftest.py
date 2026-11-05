"""Server tests run against PostgreSQL (the compose `db` service, database primgrade_test).
Start it with `docker compose up -d db`. Migrations run once; tables are emptied per test."""

import os
from pathlib import Path

import psycopg
import pytest
from alembic import command
from alembic.config import Config as AlembicConfig
from fastapi.testclient import TestClient
from primgrade_server.config import Settings
from primgrade_server.main import create_app
from primgrade_server.models import Base
from sqlalchemy import create_engine, text

ADMIN_URL = os.environ.get("TEST_ADMIN_URL", "postgresql://primgrade:primgrade@localhost:5433/primgrade")
TEST_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://primgrade:primgrade@localhost:5433/primgrade_test"
)
PNG = b"\x89PNG\r\n\x1a\n" + b"fake-image-bytes"
JPG = b"\xff\xd8\xff" + b"raw-camera-capture"


@pytest.fixture(scope="session")
def database() -> str:
    try:
        with psycopg.connect(ADMIN_URL, autocommit=True) as c:
            c.execute("DROP DATABASE IF EXISTS primgrade_test WITH (FORCE)")
            c.execute("CREATE DATABASE primgrade_test")
    except psycopg.OperationalError as e:
        pytest.exit(f"PostgreSQL is not reachable ({e}); run `docker compose up -d db`", 2)
    cfg = AlembicConfig(str(Path(__file__).parents[1] / "alembic.ini"))
    cfg.attributes["url"] = TEST_URL
    command.upgrade(cfg, "head")
    return TEST_URL


@pytest.fixture
def clean_db(database):
    engine = create_engine(database)
    with engine.begin() as c:
        names = ", ".join(t.name for t in Base.metadata.sorted_tables)
        c.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))
    engine.dispose()
    return database


def settings(url: str, storage: Path, llm: str = "fake") -> Settings:
    return Settings(database_url=url, secret_key="k" * 40, storage_dir=storage,
                    public_base_url="https://grade.example.test", llm=llm, concurrency=2,
                    secure_cookies=False, web_dist=None)


@pytest.fixture
def make_client(clean_db, tmp_path):
    made = []

    def make(llm: str = "fake") -> TestClient:
        c = TestClient(create_app(settings(clean_db, tmp_path / "storage", llm)))
        c.__enter__()
        made.append(c)
        return c

    yield make
    for c in made:
        c.__exit__(None, None, None)


@pytest.fixture
def client(make_client) -> TestClient:
    return make_client()


def signup(c: TestClient, email: str, name: str = "Teacher", password: str = "correct horse 1"):
    return c.post("/api/auth/signup", json={"email": email, "name": name, "password": password})


def login(c: TestClient, email: str, password: str = "correct horse 1"):
    return c.post("/api/auth/login", json={"email": email, "password": password})


@pytest.fixture
def admin(client) -> TestClient:
    assert signup(client, "admin@example.test", "Ada Admin").status_code == 201
    assert login(client, "admin@example.test").status_code == 200
    return client


def teacher(make_client, admin: TestClient, email: str) -> TestClient:
    """A second, approved teacher in a separate browser (own cookie jar)."""
    c = make_client()
    uid = signup(c, email, "Tess Teacher").json()["id"]
    assert admin.post(f"/api/admin/users/{uid}/status", json={"status": "approved"}).is_success
    assert login(c, email).status_code == 200
    return c


def ready_problem(c: TestClient, title: str = "P3 pallet") -> dict:
    p = c.post("/api/problems", json={"title": title}).json()
    c.patch(f"/api/problems/{p['id']}", json={"statement_text": "Pallet 80 kg, F = 350 N at 30°",
                                              "solution_text": "a = 0.69 m/s²"})
    assert c.post(f"/api/problems/{p['id']}/generate").status_code == 202
    r = c.post(f"/api/problems/{p['id']}/accept", json={"issues_acknowledged": False})
    assert r.status_code == 200, r.text
    return r.json()


def upload(c: TestClient, problem_id: str, **form) -> dict:
    r = c.post(f"/api/problems/{problem_id}/answers", data=form,
               files=[("pages", ("p1.png", PNG, "image/png"))])
    assert r.status_code == 201, r.text
    return r.json()
