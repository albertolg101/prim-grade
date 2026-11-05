# PrimGrade project guidelines

PrimGrade is a local class-project prototype for helping university physics
teachers review photographed, handwritten exam answers. It is not an
autonomous grader or a production service.

The full rules are in `rules/`. When you apply a rule, cite its id, e.g. "(D8)".

## Product directive (owned by the human)

The directive and its invariants I1–I5 are in [`docs/directive.md`](./docs/directive.md). Read it
before any product change. The agent never edits it: propose new text as a question with its
default, and the human commits it (U2).

## Always on

1. Requirements and user situations before code; plan in tasks of 20–30 minutes (D1, D3).
2. Run the tests yourself before "done"; fix the code, never weaken a test (D7).
3. No claim without the command and the output that show it (D8).
4. Every number has a source, an as-of date and a kind, and code that reproduces it (A3, A12).
5. Keep sourced fact, your analysis and speculation apart, and label each (A6).
6. When unsure, write the question with its default, apply it, log it, continue; stop only before
   anything irreversible or public, or the changes "Implementation practices" says to ask about
   first (D10).
7. Commit each working step, stage only your own files, push before you stop (D11, D13).
8. No personal data, no real person as a persona, no keys in files or prompts (A13).

## Read when

| When you are about to … | Read first |
|---|---|
| collect data, compute a number, write a finding or a recommendation | `rules/ANALYTICS_RULES.md` |
| publish a slide, a post or a summary of results | `rules/ANALYTICS_RULES.md`, A14 |
| write requirements, plan, code, test or commit | `rules/DEVELOPMENT_RULES.md` |
| let simulated users critique a screen, or triage their findings into a wave | `rules/USER_SIMULATION.md`, `tools/wave/` |
| call a user-facing feature done | `rules/USER_SIMULATION.md`, then D9 |
| work while other agents or teammates change the same repo | `rules/DEVELOPMENT_RULES.md`, D13 and D14 |
| end a session or hand over to someone | `rules/DEVELOPMENT_RULES.md`, D15 |

If `rules/USER_SIMULATION.md` is missing, follow D9 and say that it is missing.

Run a wave (no key: `--dry-run`, then paste the prompts by hand; see `tools/wave/ux_critic.md`):

```bash
uv run --with pyyaml --with anthropic --with playwright python tools/wave/simulate_wave.py \
  --directive docs/directive.md --personas tools/wave/personas.yaml \
  --url http://localhost:5173 --runs 2 --out out/wave-1
```

## Source of truth

- Read [`project_definition.md`](./project_definition.md) before changing
  product behavior or scope.
- Read [`docs/analysis/niche/niche_brief.md`](./docs/analysis/niche/niche_brief.md)
  for the validated product direction, evidence status, and research queue.
- Read [`docs/analysis/niche/README.md`](./docs/analysis/niche/README.md) before
  changing niche-analysis documents or research prompts.
- Keep related documentation, tests, and implementation behavior consistent.

## Required product journey

Preserve this vertical slice:

1. A student uploads photos of their own answer to an exercise; the teacher
   can also upload on a student's behalf. The submission is tied to the
   uploader's identity and the chosen exercise, never to a name typed by hand.
2. Keep every upload as an original and show who uploaded it, when, and for
   which exercise, so a disputed or late submission can be traced.
3. Transcribe the answer.
4. Interpret the physics.
5. Propose criterion-level rubric scores with visible evidence.
6. Let the teacher edit and approve the result.
7. Display the approved result.

Force/free-body diagrams are the initial technical focus, but the product
supports different physics exercise types. Do not silently narrow the target
to engineering students or to mechanics only.

## Domain and safety rules

- Keep transcription, physics interpretation, scoring, teacher review, and
  approval as distinct stages.
- A model output is always a draft proposal until a teacher approves it.
- Never create or display a score when input is missing, unreadable,
  conflicting, malformed, or unavailable because a provider failed. Preserve
  the source and expose a failed or review-required state.
- Every proposed score must identify its source image or transcription,
  rubric criterion, reasoning summary, and confidence or review status.
- Support partial credit and carried-error handling consistently.
- Do not automatically score diagrams or other visual artifacts unless the
  task explicitly adds that capability.
- Preserve original uploaded files. Never overwrite an original with a crop,
  normalized image, transcription, or model output.
- Use synthetic, anonymized, or explicitly authorized exam data only.
  Minimize identity data in storage, logs, prompts, fixtures, and outputs.
- Never commit credentials, secrets, or real personal data.

## Implementation practices

- Prefer small, typed modules with explicit boundaries.
- Keep domain and rubric policy out of UI-only code.
- Reuse existing helpers and patterns before adding new abstractions.
- Surface errors explicitly; do not use broad catches, silent defaults, or
  success-shaped fallbacks.
- Make precise, surgical changes and avoid unrelated cleanup.
- Before multi-file work, state the user situation, requirement, acceptance
  criterion, likely files, and smallest verification command.
- Give new requirements, user situations, tests, and work items stable IDs and
  link the requirement, implementation, and test.
- Ask before changing scoring policy, rubric semantics, evidence states,
  approval meaning, privacy handling, or fixed demo scope.

## Grader library boundary

`grader/` is the grading library that was validated with a real teacher (5 November 2026). It must
stay separate from the product at all times.

- `grader/` never imports from the product: no app package, web framework, database, storage or UI
  code. Its only runtime dependencies are `openai` and `pydantic`. It takes inputs as arguments
  (page paths, grader instructions, an `LLM` callable) and returns records; the caller stores them.
- The product imports `grader` through its public functions (`setup`, `grading`, `llm`, `schemas`)
  and lives in its own top-level folder with its own tests. Never move product code into `grader/`,
  and never copy grader logic into the product: extend the library instead.
- A change to `grader/` comes with tests in `tests/` that use the fake LLM, and the matching update
  to `docs/spec/grader.md` in the same commit (D12).
- Keep the experiment's data in `data/` (git-ignored) untouched; it is the reference set from the
  teacher test.

Check: `grep -rn "^from \|^import " grader/` shows only stdlib, `openai`, `pydantic` and `grader`
modules.

## Testing and verification

Write or update tests for the behavior being changed. Cover both normal and
failure paths, especially:

- invalid uploads and source preservation;
- missing evidence and malformed model output;
- provider failures and review-required results;
- transcription and interpretation errors;
- units, signs, vectors, significant figures, partial credit, and carried
  errors;
- teacher edits and approval transitions.

Before declaring implementation work complete, run:

```bash
uv run python -m pytest
uv run ruff check .
```

Keep real-model runs small to save tokens: a test batch, a demo or a simulated-user wave uses at
most 5 answers and one model unless the human asks for more. Never run the 300-answer target batch
without asking first.

Report the exact commands and observed results. Do not claim behavior works
without verification output. Documentation-only changes do not require these
commands unless documentation tests exist.

## Evaluation and research

- Compare the physics-aware pipeline and raw generic baseline on the same
  anonymized inputs, questions, rubrics, and comparison fields.
- Measure full-mark precision separately from coverage; agreement between two
  models is not proof of correctness.
- Measure total teacher time, including setup, image organization, review,
  corrections, and approval.
- Treat 300 submitted answers as a product target, not measured capacity,
  student count, or market size.
- Treat confidence as a review signal, not a calibrated probability.
- Treat simulated personas and public conversations as hypotheses, never as
  proof of demand, accuracy, willingness to pay, or market size.
- Record sources, dates, units, assumptions, limitations, and evidence kind
  for every reported number.

## Git and documentation hygiene

- Work in a branch and make small, focused commits.
- Stage only files belonging to the task.
- Never commit secrets, personal data, generated caches, or unrelated files.
- Keep dated project notes, decisions, research sources, screenshots, test
  findings, and remaining unknowns in the project documentation when the
  repository establishes a journal location.
