"""Grading runs (GR-07/08): one LLM call per submission x model x mode, validated server-side.

Standalone library: no storage, no HTTP. The caller passes page paths and the grader
instructions, and persists the returned runs."""

import asyncio
import time
from datetime import UTC, datetime
from pathlib import Path

from .llm import LLM
from .schemas import Exercise, HarnessAssessment, RawAssessment, Rubric, Run, Submission
from .setup import language_rule, raw_instructions


class InvalidAssessment(Exception):
    pass


def validate_harness(a: HarnessAssessment, rubric: Rubric) -> float | None:
    """Return the server-computed total (None for review_required) or raise InvalidAssessment."""
    limits = {c.id: c.max_points for c in rubric.criteria}
    ids = [s.criterion_id for s in a.criteria]
    if sorted(ids) != sorted(limits):
        raise InvalidAssessment(f"criteria {sorted(ids)} do not match rubric {sorted(limits)}")
    if a.status == "review_required":
        if any(s.points is not None for s in a.criteria):
            raise InvalidAssessment("review_required assessment must not carry scores")
        if not a.review_reasons:
            raise InvalidAssessment("review_required assessment has no review reason")
        return None
    for s in a.criteria:
        if s.points is None or not 0 <= s.points <= limits[s.criterion_id]:
            raise InvalidAssessment(
                f"{s.criterion_id}: points {s.points} outside [0, {limits[s.criterion_id]:g}]"
            )
        if not s.evidence.strip():
            raise InvalidAssessment(f"{s.criterion_id}: no evidence given")
    return sum(s.points for s in a.criteria)


def validate_raw(a: RawAssessment, max_points: float) -> float | None:
    if a.status == "review_required":
        if a.score is not None:
            raise InvalidAssessment("review_required assessment must not carry a score")
        return None
    if a.score is None or not 0 <= a.score <= max_points:
        raise InvalidAssessment(f"score {a.score} outside [0, {max_points:g}]")
    return a.score


def page_text(sub: Submission, run: Run) -> str:
    # only the anonymous submission id reaches the model, never the student label
    text = f"Submission {sub.id}: {len(sub.pages)} page(s), in order (page 1 = first image)."
    return f"{text}\n\n{language_rule(run.language)}" if run.language else text


async def grade_one(
    run: Run, ex: Exercise, sub: Submission, pages: list[Path], skill: str, llm: LLM
) -> Run:
    """Grade one submission: `pages` are its originals in order, `skill` the grader instructions."""
    t0 = time.monotonic()
    try:
        # usage is kept even when validation fails: those tokens were spent
        if run.mode == "harness":
            out, run.usage = await llm(
                run.model, skill, page_text(sub, run), pages, HarnessAssessment
            )
            run.harness = out
            run.total = validate_harness(out, ex.rubric)
        else:
            out, run.usage = await llm(
                run.model, raw_instructions(ex), page_text(sub, run), pages, RawAssessment
            )
            run.raw = out
            run.total = validate_raw(out, ex.rubric.total_points)
        run.status = out.status
    except Exception as e:  # provider, parsing or validation failure -> explicit failed run (GR-08)
        run.status, run.total = "failed", None
        run.error = f"{type(e).__name__}: {e}"
    run.duration_s = round(time.monotonic() - t0, 2)
    run.finished_at = datetime.now(UTC).isoformat(timespec="seconds")
    return run


async def run_batch(
    runs: list[Run],
    ex: Exercise,
    subs: dict[str, Submission],
    pages: dict[str, list[Path]],
    skill: str,
    llm: LLM,
    concurrency: int,
) -> list[Run]:
    """Grade all runs in parallel, at most `concurrency` LLM calls at once.

    `subs` and `pages` are keyed by submission id; `skill` is grader_instructions(ex).
    """
    sem = asyncio.Semaphore(concurrency)

    async def limited(run: Run) -> Run:
        async with sem:
            sid = run.submission_id
            return await grade_one(run, ex, subs[sid], pages[sid], skill, llm)

    return await asyncio.gather(*(limited(r) for r in runs))
