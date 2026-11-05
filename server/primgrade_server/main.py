"""The API app. Run: uv run uvicorn primgrade_server.main:app (see docker-compose.yml)."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

from . import config, db
from .grading import fail_interrupted
from .routes import admin, answers, auth, costs, exams, groups, problems, public, settings


def create_app(cfg: config.Settings | None = None) -> FastAPI:
    cfg = cfg or config.load()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        db.init(cfg.database_url)
        cfg.storage_dir.mkdir(parents=True, exist_ok=True)
        fail_interrupted()
        yield

    app = FastAPI(title="PrimGrade", lifespan=lifespan)
    app.state.settings = cfg
    for r in (auth, admin, settings, problems, answers, groups, exams, public, costs):
        app.include_router(r.router)

    @app.get("/api/health")
    def health() -> dict:
        return {"ok": True, "llm": cfg.llm}

    if cfg.web_dist:  # Docker: the built web app is served by the API on one port
        dist = cfg.web_dist.resolve()

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str):
            if path.startswith("api/"):
                raise HTTPException(404, "not found")
            target = (dist / path).resolve()
            if path and target.is_file() and dist in target.parents:
                return FileResponse(target)
            return FileResponse(dist / "index.html")

    return app


def app() -> FastAPI:  # uvicorn --factory primgrade_server.main:app
    return create_app()
