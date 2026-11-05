"""PL-33: the teacher's spending per problem, group, exam and exam+group (grading only for the
last three). Amounts are estimated from prices.json (kind: estimated)."""

from fastapi import APIRouter
from sqlalchemy import func, select

from .. import models
from ..deps import Db, Teacher

router = APIRouter(prefix="/api/costs", tags=["costs"])


def _sum(db, user_id: str, keys, *where):
    cols = [func.coalesce(func.sum(models.AiCall.cost_usd), 0.0),
            func.coalesce(func.sum(models.AiCall.total_tokens), 0), func.count(models.AiCall.id)]
    return db.execute(select(*keys, *cols).where(models.AiCall.user_id == user_id, *where)
                      .group_by(*keys)).all()


@router.get("")
def costs(db: Db, user: Teacher) -> dict:
    titles = dict(db.execute(select(models.Problem.id, models.Problem.title)
                             .where(models.Problem.owner_id == user.id)).all())
    groups = dict(db.execute(select(models.Group.id, models.Group.name)
                             .where(models.Group.owner_id == user.id)).all())
    exams = dict(db.execute(select(models.Exam.id, models.Exam.title)
                            .where(models.Exam.owner_id == user.id)).all())
    per_problem: dict[str, dict] = {}
    for pid, purpose, usd, tokens, _calls in _sum(
            db, user.id, [models.AiCall.problem_id, models.AiCall.purpose],
            models.AiCall.problem_id.is_not(None)):
        row = per_problem.setdefault(pid, {"id": pid, "title": titles.get(pid, "(deleted)"),
                                           "setup_usd": 0.0, "grading_usd": 0.0, "tokens": 0})
        row["grading_usd" if purpose == "grading" else "setup_usd"] += usd
        row["tokens"] += tokens
    grading = models.AiCall.purpose == "grading"
    return {
        "total_usd": db.scalar(select(func.coalesce(func.sum(models.AiCall.cost_usd), 0.0))
                               .where(models.AiCall.user_id == user.id)),
        "problems": list(per_problem.values()),
        "groups": [{"id": g, "name": groups.get(g, ""), "usd": usd, "tokens": t, "calls": c}
                   for g, usd, t, c in _sum(db, user.id, [models.AiCall.group_id], grading,
                                            models.AiCall.group_id.is_not(None))],
        "exams": [{"id": e, "title": exams.get(e, ""), "usd": usd, "tokens": t, "calls": c}
                  for e, usd, t, c in _sum(db, user.id, [models.AiCall.exam_id], grading,
                                           models.AiCall.exam_id.is_not(None))],
        "exam_groups": [{"exam_id": e, "exam_title": exams.get(e, ""), "group_id": g,
                         "group_name": groups.get(g, ""), "usd": usd, "tokens": t, "calls": c}
                        for e, g, usd, t, c in _sum(
                            db, user.id, [models.AiCall.exam_id, models.AiCall.group_id],
                            grading, models.AiCall.exam_id.is_not(None))],
    }
