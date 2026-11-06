"""Grade answers in the background with the grader library (PL-21); every call is costed (PL-32)."""

import asyncio
from pathlib import Path

from sqlalchemy import select

from grader.grading import grade_one
from grader.schemas import Run as GraderRun
from grader.schemas import Submission

from . import ai, db, models
from .config import MODEL, Settings


def pages_of(session, answer_id: str) -> list[models.File]:
    return list(session.scalars(
        select(models.File).join(models.AnswerPage, models.AnswerPage.file_id == models.File.id)
        .where(models.AnswerPage.answer_id == answer_id).order_by(models.AnswerPage.position)
    ))


async def grade_runs(settings: Settings, user_id: str, run_ids: list[str]) -> None:
    with db.session() as s:
        user = s.get(models.User, user_id)
        llm = ai.llm_for(settings, user)
        language = user.language  # PL-37: feedback in the teacher's language
    sem = asyncio.Semaphore(settings.concurrency)

    async def one(run_id: str) -> None:
        async with sem:
            with db.session() as s:
                row = s.get(models.Run, run_id)
                answer = s.get(models.Answer, row.answer_id)
                problem = s.get(models.Problem, answer.problem_id)
                version = s.scalar(select(models.RubricVersion).where(
                    models.RubricVersion.problem_id == problem.id,
                    models.RubricVersion.version == row.rubric_version))
                pages = pages_of(s, answer.id)
                ex = ai.exercise(problem, version.proposal, version.version)
                g = GraderRun(id=row.id, submission_id=answer.id, model=MODEL, mode="harness",
                              language=language, status="running",
                              rubric_version=row.rubric_version, max_points=row.max_points,
                              started_at=row.started_at.isoformat())
                # only the anonymous answer id reaches the model, never the student's name
                sub = Submission(id=answer.id, exercise_id=problem.id, label="",
                                 pages=[f.id for f in pages], created_at="")
                skill = version.skill
                paths = [Path(f.path) for f in pages]
            g = await grade_one(g, ex, sub, paths, skill, llm)
            with db.session() as s:
                row = s.get(models.Run, run_id)
                answer = s.get(models.Answer, row.answer_id)
                row.status, row.total, row.error = g.status, g.total, g.error
                row.language = g.language
                row.harness = g.harness.model_dump() if g.harness else None
                row.usage = g.usage.model_dump() if g.usage else None
                row.finished_at, row.duration_s = models.now(), g.duration_s
                if g.usage is not None:
                    ai.record(s, user_id, "grading", g.usage, problem_id=answer.problem_id,
                              exam_id=answer.exam_id, group_id=answer.group_id, run_id=row.id)
                s.commit()

    await asyncio.gather(*(one(r) for r in run_ids))


def fail_interrupted() -> int:
    """ADR-0001: runs left running by a restart become failed, never a score (I2); so do
    problems left preparing (PL-43)."""
    with db.session() as s:
        n = s.execute(models.Run.__table__.update().where(models.Run.status == "running").values(
            status="failed", error="interrupted by a server restart; grade it again",
            finished_at=models.now())).rowcount
        s.execute(models.Problem.__table__.update()
                  .where(models.Problem.preparing_since.is_not(None))
                  .values(preparing_since=None,
                          prepare_error="interrupted by a server restart; prepare it again"))
        s.commit()
        return n
