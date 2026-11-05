# To-do

Open work items for the prototype. Each item has a stable ID; link it from the
spec, code, and tests when it is implemented.

## TODO-01 — Show the model's thinking during exercise setup

Added 4 November 2026 · Status: open · Relates to: GR-01–04, PT-01 · Side: app (the prototype UI was removed 5 November 2026; carry into the new app's backlog)

**Situation:** While the teacher waits for the model to prepare an exercise,
they see only a "Preparing…" button and cannot tell what the model is doing or
why it proposes a given rubric.

**Want:** Show a short, readable narrative of the model's reasoning while setup
runs, for example: "Reading the statement… the pallet is pulled at 30°, so
the normal force is reduced", "The reference uses g = 10 m/s²", "Proposing 4
criteria: diagram, force balance, friction, final answer".

- Show highlights, not the full reasoning trace: a few short steps that a
  teacher would find interesting and trustworthy to skim.
- Keep it separate from the proposal itself. The narrative explains the
  proposal; it is not evidence and not part of the rubric.
- Keep it after setup finishes, collapsed by default, beside the proposed rubric.

**Possible approach (to confirm):** request reasoning summaries from the
OpenAI Responses API (`reasoning.summary`) and stream them to the UI. Check
which of the configured models support summaries and how many tokens they add,
and show those tokens in the setup usage.

**Acceptance:** During setup the teacher sees a few progressive, plain-language
steps; afterwards the steps remain viewable; the setup token count includes any
extra cost; setup still works for a model that provides no summary.

## TODO-02 — Image size setting for grading (deferred)

Added 4 November 2026 · Status: deferred until the first real batch is measured. · Side: grader library

**Measurement on 4 November 2026:** one 1280×1037 answer page, sent to the
three configured models. The page cost about 1,585 image tokens at full size
with `detail=high`, about 409 tokens resized to 640 px, and about 250 tokens
with `detail=low`. Evidence kind: `partial` (one page, transcription of a
single line only).

**Want:** A `PRIMGRADE_IMAGE_MODE` setting (`high`, a maximum pixel size, or
`low`), recorded on each run. Resized images are derived copies, so originals
stay unchanged. Adopt a lower mode only if grades and review-required flags
match full resolution on the same answers.

## TODO-03 — Drag-and-drop images

Added 4 November 2026 · Status: done (4 November 2026) · Relates to: PT-01, GR-06 · Side: app (the prototype UI was removed 5 November 2026; carry into the new app's backlog)

The teacher can drop images onto the statement and reference-solution areas
when creating an exercise, and drop images or whole folders of student answers.
Dropped folders keep their structure: each sub-folder becomes one multi-page
answer, the same as the folder picker. Typing or pasting text is no longer the
only way to provide a solution. Implementation: `web/src/DropZone.tsx`.
Not covered by automated tests (UI only). Checked in the browser with simulated
drops of single files: images are accepted and non-images are ignored. A real
folder dropped from Finder has not been checked yet.
