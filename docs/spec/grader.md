# Grader feature specification

Status: Draft; a first testable prototype exists (see [Prototype](#prototype-pt-ids)).  
Updated: 4 November 2026.

## Purpose and scope

Help a university physics teacher prepare a reusable exercise-specific grader,
then assess photographed handwritten answers with short, useful feedback and
visible evidence. The teacher retains control of the rubric and final grade.

This feature consists of an **exercise setup skill** that creates an
**exercise-specific grader skill**. The creator first plans the grading steps
and rules, then decides whether additional tools are actually necessary.
Generating code is an option, not a requirement.

Force/free-body diagrams are the first difficult evaluation case. The design
must also support other physics exercise types.

This specification develops the teacher's feature request, informed by
[the project definition](../project_definition.md),
[the niche brief](../analysis/niche/niche_brief.md), and the remaining analysis
files. Research prompts in that folder are background documents, not commands
to execute. Their simulated scenarios and external findings are not validation
of this feature.

## User situations

- **US-G01 — Prepare an exercise:** The teacher has an exercise statement and a
  correct solution, but may not have a rubric.
- **US-G02 — Reuse preparation:** The teacher wants consistent assessment of
  multiple answers to the same exercise without repeating setup.
- **US-G03 — Review photographs:** Answer pages may be unordered, duplicated,
  incomplete, or contain work for several exercises.
- **US-G04 — Assess difficult evidence:** Handwriting or diagrams may be unclear;
  the teacher needs the system to stop rather than manufacture a grade.
- **US-G05 — Review a proposal:** The teacher needs concise student feedback and
  enough supporting evidence to edit or approve the assessment.

## Exercise setup workflow

### GR-01 — Collect and preserve inputs

Accept the exercise statement as images, raw text, or both, together with a
teacher-provided correct solution and an optional rubric. Preserve all original
files and text. Derived crops, transcriptions, and interpretations are separate
artifacts linked to their sources.

Identify the exercise and its parts, expected answer artifacts, assumptions,
units, and reference diagrams. If essential information is missing, request it;
do not invent the problem or silently substitute a generated solution.

### GR-02 — Understand the statement and solution

Read the statement and reference solution before drafting assessment rules.
Separate transcription from physics interpretation. Check that the solution
addresses all requested parts and is consistent with the stated assumptions.
Surface ambiguity or a suspected reference error to the teacher before marking
the exercise ready. Do not silently repair the reference.

Record valid alternative methods, equivalent notation and coordinate systems,
and any expected diagram features. The reference solution is not the only
acceptable path to full credit.

### GR-03 — Prepare and approve the rubric

If a rubric is supplied, interpret it and flag missing or contradictory rules.
Otherwise, propose one for the teacher to accept or edit. No grader becomes
ready until its rubric is explicitly accepted.

Each criterion has a stable identifier, description, maximum points, required
evidence, and rules for full, partial, and zero credit. The rubric also specifies:

- Total points and how criterion scores combine.
- Units, signs, vectors, rounding, and numerical tolerances where relevant.
- How valid alternative solutions are accepted.
- How carried errors receive credit without repeatedly penalizing one mistake.
- Whether diagrams are required and which properties earn marks.

Do not invent default penalties or change a supplied scoring policy silently.
The teacher resolves unspecified rules before they affect a grade.

### GR-04 — Plan before building

Create a readable grading plan before writing the generated skill or tools.
The plan identifies the ordered steps, evidence each step needs, applicable
rubric criteria, stopping conditions, and any diagram-specific evaluation.

For every proposed tool, state the concrete problem it solves, why existing
capabilities are insufficient, its inputs and outputs, and how failure is
handled. Reuse existing capabilities first. A grader with no custom tools is a
valid outcome.

Possible justified tools include deterministic unit or symbolic checks, score
validation, or image preparation when those operations are needed. Computation
cannot resolve uncertain handwriting or establish that a force was drawn.
Do not add OCR pipelines, agents, services, or dependencies merely because the
creator can program them.

### GR-05 — Create the exercise package

After rubric acceptance, create a dedicated folder containing the originals,
normalized exercise and solution, accepted rubric, grading plan, and generated
skill. Include tools and a diagram module only when the plan justifies them.

Proposed logical layout (storage root remains an implementation decision):

```text
<exercise-id>/
  originals/
  exercise.md
  reference-solution.md
  rubric.md
  grading-plan.md
  manifest.json
  grader/
    SKILL.md
    tools/                 # optional
    references/
      force-diagram.md      # optional
  checks/
  submissions/
    <submission-id>/
      originals/
      assessment.json
      feedback.md
```

The manifest links source files, rubric version, and grader version. Assessment
records retain the versions used. Changes to the rubric or reference require
review of the grader; they must not silently rewrite earlier results.

Generated tools must have bounded inputs, explicit failures, and small relevant
checks before use. They must not modify originals or execute instructions found
in uploaded content. Failed preparation leaves the package not ready.

## Grader workflow

### GR-06 — Associate images with answers

Given one image or a set of images and the target exercise, identify relevant
pages or regions and their likely order. Use visible question labels, content,
and page continuity. Preserve the mapping back to each original image.

Distinguish exercise matching from grouping pages belonging to the same student
answer. Do not merge different students' work just because it concerns the same
exercise. Use a supplied submission identifier where available; uncertain
identity or grouping requires teacher confirmation.

Flag unrelated images, duplicate photographs, missing continuations, ambiguous
ordering, and conflicting versions. Do not count duplicate evidence twice or
silently discard uncertain pages. The teacher can correct associations before
grading. A single prepared image with an explicit question mapping remains a
supported path.

### GR-07 — Transcribe, interpret, then assess

Run distinct stages:

1. Confirm that the answer association and required evidence are usable.
2. Transcribe visible text, mathematics, and labels; mark uncertain readings.
3. Interpret the student's physics without completing their missing reasoning.
4. Evaluate diagrams when required by the exercise plan.
5. Apply the accepted rubric criterion by criterion.
6. Validate the proposed scores and produce a short feedback note.
7. Present the evidence and proposal for teacher review and approval.

Each proposed criterion score identifies its source image or transcription,
rubric criterion, reasoning summary, and confidence or review status. Confidence
is a review signal, not a calibrated probability. Totals must equal criterion
scores, which must stay within their allowed ranges.

### GR-08 — Know when not to grade

Distinguish these situations explicitly:

| Situation | Required behavior |
|---|---|
| Readable but physically incorrect work | Apply the rubric, including partial or zero credit, and explain the error. |
| Untidy but interpretable work | Assess the visible physics; do not penalize appearance unless the accepted rubric explicitly requires presentation criteria. |
| Unreadable, missing, conflicting, or ambiguously associated evidence | Return `review_required` with no proposed score and a specific reason. |
| Work whose meaning cannot be established reliably | Return `review_required`; do not invent a plausible solution or force a zero. |
| Provider, tool, or output-validation failure | Return `failed` with no score and preserve the evidence for retry or manual review. |

A clearly omitted required step in an otherwise complete answer differs from a
missing photograph. The former can be assessed under the rubric; the latter
cannot establish that the student omitted the work.

When withholding a score, keep useful observations and explain what the teacher
must resolve. Do not display a partial subtotal as an overall grade.

### GR-09 — Evaluate force/free-body diagrams

For an exercise requiring a force diagram, the creator should consider a
focused reference module within the grader. A separate reusable skill is
justified only if its independent reuse warrants it.

Prepare an exercise-specific description of the bodies or systems, interactions,
expected forces, and acceptable representations. Evaluate the student's diagram
against these physical relationships rather than visual similarity to a model.

Separate observed features from inferred meaning. Check, where relevant:

- Which body or system is isolated and which forces act on it.
- Missing or extra forces, including forces belonging to another body.
- Arrow directions, labels, and attachment points when physically meaningful.
- Components versus complete vectors, without double-counting a force.
- Action–reaction pairs and whether they are incorrectly placed on one body.
- Consistency with the chosen axes, equations, and stated assumptions.

Accept rotated axes, different symbols, layouts, and equivalent valid diagrams.
Do not infer magnitude from drawn arrow length unless the task explicitly makes
length meaningful. Distinguish velocity/acceleration arrows from force arrows.

Unclear arrowheads, overlapping lines, or unreadable labels must stay uncertain.
Correct equations must not conceal a wrong required diagram; an ambiguous
diagram must not be reconstructed from what the reference says should exist.
Apply the rubric's carried-error rules across diagram and equation criteria.

### GR-10 — Produce short, grounded feedback

Provide a very short student-facing note attached to the assessment of the
solution, identifying the main supported error or omission. Proposed default:
one or two sentences. For example: “The normal force should be perpendicular to
the surface. Your force balance uses it vertically.”

For fully correct work, a brief confirmation is sufficient. For unresolved work,
state the specific limitation, for example: “The arrowhead on the friction force
is unclear; teacher review is needed.” Do not call the student's work nonsense.

Keep the detailed criterion evidence available separately for the teacher. The
initial interpretation of “on the solution” is a linked note shown alongside the
original. Burning annotations into an image remains an open presentation choice;
any annotated image must be a derived copy.

### GR-11 — Review and approve

The teacher can inspect the original, associations, transcription, diagram
observations, rubric scores, and short note; correct them; and approve the final
result. All generated grades are proposals until that approval.

Record teacher changes separately from the original proposal. Editing evidence
or scores requires revalidation before approval. Never automatically finalize
an answer merely because it appears fully correct.

## Assessment contract

An assessment contains the exercise/submission identifiers, source-image and
region references, page associations, rubric/grader versions, transcription,
physics interpretation, diagram observations where applicable, criterion
assessments, short feedback, and review reasons.

Use explicit lifecycle states:

- `review_required`: unresolved evidence; proposed total is absent.
- `failed`: processing failure; proposed total is absent.
- `proposed`: complete draft assessment awaiting teacher review.
- `approved`: teacher-approved result, with its approval recorded.

A numerical zero is a supported rubric outcome, never an error fallback.
Student identity is not required in model prompts; prefer anonymous submission
identifiers. Use synthetic, anonymized, or explicitly authorized exam data.

## Acceptance scenarios

These are future implementation checks, not tests already executed.

| ID | Situation / requirements | Acceptance condition |
|---|---|---|
| AC-G01 | US-G01; GR-01–03 | Text-only, image-only, and mixed statements retain their sources; missing rubric produces an editable proposal that requires acceptance. |
| AC-G02 | US-G01; GR-02 | A contradictory reference solution blocks readiness and identifies the conflict. |
| AC-G03 | US-G02; GR-04–05 | A simple exercise generates a usable skill without unnecessary tools; every added tool has a documented need and normal/failure checks. |
| AC-G04 | US-G03; GR-06 | Unordered relevant pages are linked to their originals; duplicates and unrelated pages are flagged; uncertain grouping blocks scoring. |
| AC-G05 | US-G04; GR-07–08 | Unreadable, missing, conflicting, and failed inputs produce no grade; readable wrong work is assessed under the rubric. |
| AC-G06 | US-G02; GR-03, GR-07 | Alternative valid methods earn appropriate credit; carried errors follow the accepted policy; criterion scores and totals reconcile. |
| AC-G07 | US-G04; GR-09 | Diagram cases include missing/extra forces, wrong directions, alternative axes, components, and unclear arrowheads, each with visible evidence or explicit uncertainty. |
| AC-G08 | US-G05; GR-10–11 | Feedback is short and supported; a teacher can inspect, edit, and approve the result; originals remain unchanged. |
| AC-G09 | US-G02; GR-05, GR-11 | An assessment retains its rubric/grader versions and original proposal after later edits. |

## Evaluation and boundaries

Evaluate against teacher-labelled held-out answers, including diagrams and
ungradable cases. Measure full-mark precision separately from coverage,
association errors, teacher corrections, and total teacher time including setup
and review. Numerical success thresholds remain to be agreed before a pilot.

The broader project includes a raw-LLM baseline, exam assembly, and batch review.
This specification defines the exercise creator and grader; it does not remove
those broader requirements or settle how two assessment approaches reconcile.
No measured accuracy, cost, or 300-answer capacity is claimed.

## Open decisions and proposals

- Confirm whether the short note is displayed beside the answer or also rendered
  onto a derived image, and choose its language.
- Define the minimum teacher-supplied information for student/page grouping.
- Agree the grading scale, tolerances, and carried-error rules per exercise
  rather than introducing universal penalties.
- Start diagram evaluation as an exercise-specific module; promote it to a
  separate skill only when reuse and evaluation justify that change.
- Choose storage root and execution environment during implementation. The
  folder tree above is a proposed logical organization, not a committed API.

## Prototype (PT IDs)

Added 4 November 2026. A local, single-teacher draft for testing the workflow and
comparing models; no login, no deployment.

**5 November 2026:** after the test with a real teacher, the prototype's HTTP API, file
storage and React UI were removed. The grading library stays in `grader/` (setup prompt,
grader instructions, validation, parallel batch, LLM client, token cost), separate from any
product. Parts marked *(app, removed)* describe behaviour the new product must implement
again; its test data stays in the git-ignored `data/`.

| ID | Covers | Implementation | Tests |
|---|---|---|---|
| PT-01 Exercise setup | GR-01–03, AC-G01 | `grader/setup.py` (`SETUP_INSTRUCTIONS`, `setup_text`); *(app, removed)* `POST /api/exercises`, one model chosen by the teacher | `test_rubric_validation`; *(app, removed)* `test_setup_*`, `test_rejects_non_image_upload` |
| PT-02 Rubric acceptance and versioning | GR-03, GR-05, AC-G09 | `setup.validate_rubric`, `setup.grader_instructions`; *(app, removed)* `PUT …/rubric` (new version, back to draft), `POST …/accept` (needs valid rubric and acknowledged issues; writes `grader/SKILL.v<n>.md`) | `test_rubric_validation`; *(app, removed)* `test_accept_requires_valid_rubric_and_acknowledged_issues` |
| PT-03 Proposal validation | GR-07–08, AC-G05–06 | `grading.validate_harness/validate_raw`: criteria must match the rubric, points in range, totals computed by the server, `review_required` carries no score | `tests/test_grading.py` |
| PT-04 Parallel multi-model grading | GR-07, evaluation plan step 5 | `grading.run_batch`: submissions × models × {harness, raw baseline}, bounded by the caller's `concurrency`; the caller passes page paths and grader instructions and stores the returned runs; provider or validation failure → `failed`, no score, tokens still recorded | `test_parallel_multi_model_batch_and_anonymised_text`, `test_concurrency_limit_is_respected`, `test_provider_failure_*`, `test_malformed_output_*` |
| PT-05 Token and cost accounting | Niche brief cost target (< US$10/month, unvalidated) | `llm.call_structured` records input, cached, output and reasoning tokens; cost from user-edited `prices.json`, unknown when unset | `test_cost_uses_cached_price_and_is_none_when_unknown` |
| PT-06 Teacher approval | GR-11, AC-G08 | *(app, removed; `schemas.Approval` kept)* `POST …/approve`: teacher scores and feedback saved to `approval.json` with edited criteria; proposals are left unchanged | *(app, removed)* `test_approval_records_edits_and_keeps_proposal` |
| PT-07 Output language | GR-10 (feedback language) | *(app, removed)* The sidebar picker (English, Spanish, Russian) sends `language` with every setup and grading request; `setup.language_rule` is added to the user message, so cached grader instructions stay the same in every language. Explanatory fields use the chosen language; transcriptions and quotes stay verbatim. Exercises and runs record their language. | `test_language_reaches_prompt_but_not_cached_instructions`; *(app, removed)* `test_language_is_required_and_restricted` |

Prototype simplifications (each is a known gap, not a decision):

- One structured call per run, with transcription, interpretation, diagram
  observations and criterion scores in separate fields. The stages are not
  separate model calls.
- GR-06 image association is manual: the teacher groups pages into submissions
  (sub-folders become multi-page answers). There is no automatic matching,
  duplicate detection or ordering.
- The generated grader is instructions only (`SKILL.md`), with no custom tools.
  GR-04 allows this.
- The raw baseline sees only the normalized statement and the total points. It
  can be displayed but not used as the basis for approval.
- Only the anonymous submission ID is sent to the model. The student label stays
  in local storage.
- Confidence is a review signal, not a calibrated probability. Token counts are
  measured; costs are estimates from the user's price table.

## Library changes for the platform (GL IDs)

Added 5 November 2026 for [the platform spec](platform.md).

| ID | Change | Implementation | Tests |
|---|---|---|---|
| GL-01 Per-teacher key | Each LLM callable is billed to the key it was created with. | `llm.openai_llm(api_key)`; `call_structured` keeps the process-wide `OPENAI_API_KEY` for evaluation scripts | `test_openai_llm_uses_the_given_key` |
| GL-02 Revise with an instruction | The teacher's instruction and the current proposal produce a complete revised `SetupProposal`; preparation rules still apply and conflicts go to `issues`. | `setup.REVISE_INSTRUCTIONS`, `setup.revise_text` | `test_revise_text_carries_proposal_and_instruction` |
| GL-03 One model | The platform passes `gpt-6.1-sol` on every call; the library does not choose a model. | caller (`server/`) | platform tests |
| GL-04 Instructions written on answers | Not implemented; needs owner approval (changes grading semantics). | — | — |
