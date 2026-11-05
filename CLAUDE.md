@AGENTS.md
@docs/directive.md

## Commands

```bash
uv sync                          # Python 3.12 deps (grader library + dev tools)
docker compose up -d db          # PostgreSQL on 127.0.0.1:5433 (server tests need it)
uv run python -m pytest          # grader + server tests (fake LLM, no network)
uv run ruff check .              # lint
```

## Layout

- `grader/` is the standalone grading library; see "Grader library boundary" in AGENTS.md.
- `grader/llm.py` is the only module that calls OpenAI; tests pass a fake with the same signature.
- `grader/setup.py` holds the exercise-setup prompt and the generated grader instructions.
- `grader/grading.py` contains validation and the parallel batch; callers pass page paths and store runs.
- `server/` is the platform API (FastAPI, PostgreSQL); `web/` is the React app (`npm run build`).
- `PRIMGRADE_LLM=fake` runs the platform on a deterministic fake model (no key, no tokens).
- `input/` is the teacher-test exam set, committed as authorised test data (one folder per problem).
  `data/` holds runtime state and is git-ignored; never commit it.
