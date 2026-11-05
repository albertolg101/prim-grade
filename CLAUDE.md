@AGENTS.md
@docs/directive.md

## Commands

```bash
uv sync                          # Python 3.12 deps (grader library + dev tools)
uv run python -m pytest          # library tests (fake LLM, no network)
uv run ruff check .              # lint
```

## Layout

- `grader/` is the standalone grading library; see "Grader library boundary" in AGENTS.md.
- `grader/llm.py` is the only module that calls OpenAI; tests pass a fake with the same signature.
- `grader/setup.py` holds the exercise-setup prompt and the generated grader instructions.
- `grader/grading.py` contains validation and the parallel batch; callers pass page paths and store runs.
- `input/` and `data/` hold real exam images and the teacher-test data, and are git-ignored. Never commit them.
