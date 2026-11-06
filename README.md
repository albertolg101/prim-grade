# PrimGrade

Teacher-reviewed grading of photographed, handwritten physics answers. Every grade is a proposal
until the teacher approves it. See [`docs/project_definition.md`](docs/project_definition.md), the
directive in [`docs/directive.md`](docs/directive.md) and the grader spec in
[`docs/spec/grader.md`](docs/spec/grader.md).

The first prototype was tested with a real teacher and removed on 5 November 2026; its **grading
library** stays in `grader/`, separate from the platform in `server/` and `web/` that uses it
(spec: [`docs/spec/platform.md`](docs/spec/platform.md), plan: [`docs/plan/platform.md`](docs/plan/platform.md)).

## Layout

- `grader/`: the grading library, with no storage, HTTP or UI.
  - `setup.py`: the exercise-setup prompt, rubric validation and the generated grader instructions.
  - `grading.py`: validation of model proposals and the parallel batch (`run_batch`).
  - `llm.py`: the OpenAI client and token cost from `prices.json`.
  - `schemas.py`: exercise, rubric, submission, run and approval records.
- `tests/`: library tests with a fake LLM (no network).
- `server/`: the platform API (FastAPI, SQLAlchemy, Alembic, PostgreSQL) and its tests.
- `web/`: the web app (React, Vite, Tailwind, shadcn/ui; jscanify scanner vendored in `public/vendor`).
- `rules/`, `tools/wave/`: the agent rules pack and the simulated-user wave harness (DS403 session 10).
- `data/`: runtime state from the teacher test; git-ignored, never committed.
- `input/`: the teacher-test exam set, committed as authorised test data.
  `input/<variant>_P<n>/` holds one problem: `statement.txt` (from the exam .docx), `rubric.txt`
  (the teacher's original rubric), `teacher_solution.jpg` and `student_solutions/student_NN/` (pages).

## Run the platform

```bash
echo "PRIMGRADE_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(40))')" > .env
docker compose up --build
```

Open http://localhost:8080. The first account to sign up becomes the admin; later sign-ups wait for
approval. Each teacher saves their own OpenAI API key in Settings. Add `PRIMGRADE_LLM=fake` to
`.env` for a demo with a fake model (no key, no tokens; the UI shows a banner). Students' phones
need `PUBLIC_BASE_URL` set to an address they can reach, used in the QR code; the live camera needs
HTTPS there, and without it the scanner falls back to the phone's own camera app.

Develop without Docker for the app (the database still runs in Docker):

```bash
docker compose up -d db
export PRIMGRADE_PRICES=$PWD/prices.json PRIMGRADE_SECRET_KEY=<32+ chars> PRIMGRADE_LLM=fake
(cd server && uv run alembic upgrade head && uv run uvicorn primgrade_server.main:app --factory --port 8000)
cd web && npm install && npm run dev   # http://localhost:5173, proxies /api to :8000
```

## Test

```bash
docker compose up -d db
uv sync
uv run python -m pytest   # grader + server (server tests use database primgrade_test)
uv run ruff check .
cd web && npm run build
```

## Grading library

`grader.grading.run_batch(runs, exercise, submissions, pages, grader_instructions(exercise), call_structured, concurrency)`
returns the graded runs; the caller stores them. Set `OPENAI_API_KEY` in the environment for real
calls, and fill `prices.json` (USD per 1M tokens) to get cost estimates.
