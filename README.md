# PrimGrade

Teacher-reviewed grading of photographed, handwritten physics answers. Every grade is a proposal
until the teacher approves it. See [`docs/project_definition.md`](docs/project_definition.md), the
directive in [`docs/directive.md`](docs/directive.md) and the grader spec in
[`docs/spec/grader.md`](docs/spec/grader.md).

The first prototype (API and UI) was tested with a real teacher and then removed on 5 November 2026.
What remains is the **grading library**, kept separate from the product that will use it.

## Layout

- `grader/`: the grading library, with no storage, HTTP or UI.
  - `setup.py`: the exercise-setup prompt, rubric validation and the generated grader instructions.
  - `grading.py`: validation of model proposals and the parallel batch (`run_batch`).
  - `llm.py`: the OpenAI client and token cost from `prices.json`.
  - `schemas.py`: exercise, rubric, submission, run and approval records.
- `tests/`: library tests with a fake LLM (no network).
- `rules/`, `tools/wave/`: the agent rules pack and the simulated-user wave harness (DS403 session 10).
- `data/`, `input/`: real exam data from the teacher test; git-ignored, never committed.

## Use

```bash
uv sync
uv run python -m pytest
uv run ruff check .
```

`grader.grading.run_batch(runs, exercise, submissions, pages, grader_instructions(exercise), call_structured, concurrency)`
returns the graded runs; the caller stores them. Set `OPENAI_API_KEY` in the environment for real
calls, and fill `prices.json` (USD per 1M tokens) to get cost estimates.
