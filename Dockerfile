# PrimGrade app image: the web build served by the FastAPI server on one port (ADR-0001).
FROM node:22.15-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11.28 /uv /bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY pyproject.toml uv.lock README.md ./
COPY grader/ grader/
COPY server/ server/
RUN uv sync --frozen --no-dev --package primgrade-server
COPY prices.json ./
COPY --from=web /web/dist web/dist
ENV PATH="/app/.venv/bin:$PATH" PRIMGRADE_WEB_DIST=/app/web/dist PRIMGRADE_PRICES=/app/prices.json \
    PRIMGRADE_STORAGE=/data/storage
EXPOSE 8000
CMD ["sh", "-c", "alembic -c server/alembic.ini upgrade head && uvicorn primgrade_server.main:app --factory --host 0.0.0.0 --port 8000"]
