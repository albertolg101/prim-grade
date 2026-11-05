"""Exercise setup skill (GR-01–04) and the generated grader instructions (GR-05)."""

from .schemas import Exercise, Language, Rubric

LANGUAGES: dict[str, str] = {"en": "English", "es": "Spanish", "ru": "Russian"}

SETUP_INSTRUCTIONS = """\
You prepare a university physics exercise for teacher-reviewed grading of handwritten answers.

Inputs: the exercise statement and a teacher-provided reference solution (text and/or images),
and optionally a teacher rubric. Work in this order:

1. Transcribe the statement and the reference solution into `normalized_statement` and
   `normalized_solution` (keep the original language; use plain text with simple math notation).
   Keep only the part of the statement this exercise is about if the source contains several.
2. Check the solution addresses every requested part and is consistent with the stated
   assumptions (e.g. g value). Do NOT silently repair the reference: report any suspected error,
   ambiguity, or missing information in `issues`. Never invent missing data.
3. List `final_answers` with units, the `assumptions`, whether a force/free-body diagram is
   required (`diagram_required`) and, if relevant, the `expected_forces` on each body.
4. Rubric: if the teacher supplied one, interpret it faithfully (keep its points and policy)
   and put contradictions or gaps in `issues`. Otherwise propose a rubric whose total equals the
   exercise's stated points (if stated). Each criterion needs a short stable id (C1, C2, ...),
   description, max_points, required evidence, and rules for full, partial and zero credit.
   Include the carried-error policy (an earlier mistake must not be penalised repeatedly),
   tolerances (units, signs, vectors, rounding/significant figures), and valid alternative
   methods (the reference is not the only path to full credit). Do not invent penalties for
   neatness or presentation.
5. `grading_plan`: the ordered checks a grader should perform, including stopping conditions
   (unreadable, missing pages, ambiguous evidence -> teacher review).

`issues` is empty only if nothing needs the teacher's attention.
"""


def language_rule(language: Language) -> str:
    """Appended to the user message (not the instructions) so cached instruction prefixes stay
    shared across languages. Transcriptions stay verbatim: translating them would alter evidence."""
    name = LANGUAGES[language]
    return (
        f"Output language: write every explanatory text field in {name} (rubric, plan, issues, "
        f"interpretation, reasoning, feedback, comments, review reasons). Transcriptions and "
        f"quotes of the original statement, solution or student work stay verbatim in their "
        f"original language. This overrides any other language instruction."
    )


def setup_text(
    title: str,
    statement: str,
    solution: str,
    rubric: str,
    n_stmt: int,
    n_sol: int,
    language: Language,
) -> str:
    parts = [f"Exercise title: {title}"]
    parts.append(f"Statement (text):\n{statement or '(none - see images)'}")
    parts.append(f"Reference solution (text):\n{solution or '(none - see images)'}")
    parts.append(f"Teacher rubric:\n{rubric or '(none supplied - propose one)'}")
    if n_stmt or n_sol:
        parts.append(
            f"Attached images: the first {n_stmt} show the statement, "
            f"the next {n_sol} show the reference solution."
        )
    parts.append(language_rule(language))
    return "\n\n".join(parts)


def validate_rubric(rubric: Rubric) -> list[str]:
    errors = []
    if not rubric.criteria:
        errors.append("rubric has no criteria")
    ids = [c.id.strip() for c in rubric.criteria]
    if any(not i for i in ids):
        errors.append("every criterion needs an id")
    dups = sorted({i for i in ids if ids.count(i) > 1})
    if dups:
        errors.append(f"duplicate criterion ids: {', '.join(dups)}")
    for c in rubric.criteria:
        if c.max_points <= 0:
            errors.append(f"{c.id}: max_points must be > 0")
    return errors


def _bullets(items: list[str]) -> str:
    return "\n".join(f"- {i}" for i in items) or "- (none)"


def grader_instructions(ex: Exercise) -> str:
    """The exercise-specific grader 'skill' (SKILL.md). No custom tools: GR-04 allows that."""
    p, r = ex.proposal, ex.rubric
    criteria = "\n\n".join(
        f"### {c.id} — {c.description} (max {c.max_points:g})\n"
        f"- Required evidence: {c.required_evidence}\n"
        f"- Full credit: {c.full_credit}\n"
        f"- Partial credit: {c.partial_credit}\n"
        f"- Zero credit: {c.zero_credit}"
        for c in r.criteria
    )
    diagram = ""
    if p.diagram_required:
        diagram = f"""
## Force diagram (required)
Expected forces:
{_bullets(p.expected_forces)}

Evaluate the student's diagram against physical relationships, not visual similarity:
which body is isolated, missing or extra forces (including forces on another body),
directions, labels, components vs full vectors (no double counting), action-reaction pairs
wrongly on one body, consistency with axes and equations. Accept rotated axes, other symbols
and equivalent layouts. Do not infer magnitude from arrow length. Distinguish velocity or
acceleration arrows from forces. Unclear arrowheads or labels stay uncertain; never reconstruct
an ambiguous diagram from what the reference says should exist. Correct equations do not
conceal a wrong required diagram.
"""
    return f"""\
# Grader skill: {ex.title} (rubric v{ex.rubric_version}, total {r.total_points:g} points)

You assess one student's photographed handwritten answer. Your output is a DRAFT proposal
for a teacher; the teacher decides the final grade.

## Stages (keep them distinct in the output)
1. Check the pages are usable and contain an answer to THIS exercise. Pages may also contain
   work on other exercises - ignore that work.
2. `transcription`: transcribe the visible text, maths and labels relevant to this exercise.
   Mark uncertain readings with [?].
3. `interpretation`: describe the student's physics reasoning. Do not complete missing reasoning.
4. `diagram_observations`: observed diagram features, separating what is seen from what is
   inferred ("none" if no diagram is present or required).
5. Apply the rubric criterion by criterion. Give exactly one entry per rubric criterion id.
   `source` names the page (e.g. "page 1") or transcription line. `evidence` quotes or
   describes what is visible. `reasoning` is one or two sentences. `confidence` is a review
   signal (high/medium/low), not a probability.
6. `feedback`: one or two short sentences for the student naming the main supported error or
   omission, or a brief confirmation if fully correct. Use the output language given in the
   request.
   Never insult the work.

## When NOT to grade
- Readable but physically wrong work: grade it (partial or zero credit) and explain.
- Untidy but interpretable work: grade the physics; never penalise appearance.
- Unreadable, missing, conflicting, or ambiguous evidence, or work whose meaning cannot be
  established reliably: set `status` = "review_required", set EVERY criterion `points` to null,
  and list specific `review_reasons` the teacher must resolve. Keep useful observations.
- A clearly omitted step in an otherwise complete answer can be graded; a missing page cannot.
- Otherwise `status` = "proposed", every `points` is a number within [0, max], and
  `review_reasons` lists anything the teacher should still double-check (may be empty).
Zero is a legitimate score, never a fallback for uncertainty.

## Exercise
{p.normalized_statement}

## Reference solution (one valid path, not the only one)
{p.normalized_solution}

Final answers:
{_bullets(p.final_answers)}

Assumptions:
{_bullets(p.assumptions)}
{diagram}
## Rubric
{criteria}

Carried errors: {r.carried_error_policy}

Tolerances (units, signs, vectors, rounding): {r.tolerances}

Valid alternative methods: {r.alternative_methods}

## Grading plan
{_bullets(p.grading_plan)}
"""


def raw_instructions(ex: Exercise) -> str:
    """Raw baseline: what a teacher gets from a generic LLM without the harness."""
    return f"""\
Grade this student's handwritten answer to the physics problem below out of \
{ex.rubric.total_points:g} points. Give the score and a short comment. If you cannot read or \
find the answer, set status to "review_required" and score to null.

Problem:
{ex.proposal.normalized_statement}
"""
