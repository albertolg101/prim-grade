# PrimGrade project guidelines

PrimGrade is a local class-project prototype for helping university physics
teachers review photographed, handwritten exam answers. It is not an
autonomous grader or a production service.

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

1. Upload a prepared exam-page image.
2. Enter the student name and map the page to a question.
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

```powershell
python -m pytest
ruff check .
```

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
