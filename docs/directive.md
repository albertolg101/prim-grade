# Directive — PrimGrade

<!--
Owned by the human (U1, U2). The agent never edits this file; it proposes new text as a question
with its default. Change it only outside a wave, as a decision of its own.
DRAFT 2026-11-05: proposed by the agent from AGENTS.md and the niche brief. Rewrite it in your own
words, then commit it.
-->

## Directive

PrimGrade helps university physics teachers who personally mark batches of photographed, handwritten
exam answers spend less total time grading. It proposes criterion-level scores with visible evidence,
and the teacher reviews, edits and approves them answer by answer. Fully correct answers should be
cleared with high precision, and the rest arrive with a proposed grade and a comment. The teacher
decides every final grade. Success is net teacher time saved across the whole workflow (setup,
organising images, review, corrections), with full-mark precision measured separately from coverage.

## Invariants (what no wave may break)

- **I1** — Every score shown is a draft until a teacher approves it; nothing becomes final without a teacher action.
- **I2** — No score is created or shown when the input is missing, unreadable, conflicting or malformed, or a provider failed; the answer shows a failed or review-required state instead.
- **I3** — Every proposed score shows its source image or transcription, its rubric criterion, a reasoning summary and a confidence or review status.
- **I4** — The original uploaded image is never overwritten or hidden behind a crop, transcription or model output.
- **I5** — Transcription, physics interpretation, scoring and approval are separate stages the teacher can tell apart.
