"""PL-25, PL-51: groups (a class or a section); their students are the names that submitted."""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import select

from .. import models
from ..deps import Db, Teacher, owned
from ..usage import last_used
from .answers import state
from .exams import exam_out

router = APIRouter(prefix="/api/groups", tags=["groups"])


class GroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class GroupEdit(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    archived: bool | None = None


def group_out(db, g: models.Group, used=None) -> dict:
    students = db.scalars(select(models.Answer.student_name).distinct().where(
        models.Answer.group_id == g.id, models.Answer.student_name != "")
        .order_by(models.Answer.student_name)).all()
    # PL-51: a group counts as used when it is created, and when an answer in it is used
    used = max(g.created_at, used) if used else g.created_at
    return {"id": g.id, "name": g.name, "archived": g.archived, "students": students,
            "created_at": g.created_at.isoformat(), "last_used_at": used.isoformat()}


@router.get("")
def list_groups(db: Db, user: Teacher) -> list[dict]:
    rows = db.scalars(select(models.Group).where(models.Group.owner_id == user.id)
                      .order_by(models.Group.archived, models.Group.name)).all()
    used = last_used(db, models.Group, models.Answer.group_id, user.id)
    return [group_out(db, g, used.get(g.id)) for g in rows]


@router.post("", status_code=201)
def new_group(body: GroupIn, db: Db, user: Teacher) -> dict:
    g = models.Group(owner_id=user.id, name=body.name.strip())
    db.add(g)
    db.commit()
    return group_out(db, g)


@router.patch("/{group_id}")
def edit_group(group_id: str, body: GroupEdit, db: Db, user: Teacher) -> dict:
    g = owned(db, models.Group, group_id, user)
    if body.name is not None:
        g.name = body.name.strip()
    if body.archived is not None:
        g.archived = body.archived
    db.commit()
    return group_out(db, g)


@router.post("/{group_id}/opened", status_code=204)
def group_opened(group_id: str, db: Db, user: Teacher) -> None:
    """PL-54: opening a group makes it recently used."""
    owned(db, models.Group, group_id, user).opened_at = models.now()
    db.commit()


@router.get("/{group_id}")
def get_group(group_id: str, db: Db, user: Teacher) -> dict:
    """PL-51: a group with its exams and its problems: those in its exams and those with answers
    in it, each with the group's answers counted by state and the ones ready to grade."""
    g = owned(db, models.Group, group_id, user)
    exams = db.scalars(select(models.Exam).join(models.ExamGroup,
                                                models.ExamGroup.exam_id == models.Exam.id)
                       .where(models.ExamGroup.group_id == g.id)
                       .order_by(models.Exam.created_at.desc())).all()
    in_exams = select(models.ExamProblem.problem_id).join(
        models.ExamGroup, models.ExamGroup.exam_id == models.ExamProblem.exam_id).where(
        models.ExamGroup.group_id == g.id)
    answered = select(models.Answer.problem_id).where(models.Answer.group_id == g.id)
    problems = db.scalars(select(models.Problem).where(
        models.Problem.owner_id == user.id,
        models.Problem.id.in_(in_exams.union(answered).scalar_subquery()))
        .order_by(models.Problem.updated_at.desc())).all()
    answers = db.scalars(select(models.Answer).where(models.Answer.group_id == g.id)).all()
    by_problem: dict[str, dict] = {p.id: {"answers": 0, "approved": 0, "to_grade": []}
                                   for p in problems}
    for a in answers:
        row = by_problem[a.problem_id]
        st = state(db, a)["state"]
        row["answers"] += 1
        row["approved"] += st == "approved"
        if a.selected and st == "not_graded":
            row["to_grade"].append(a.id)
    used = last_used(db, models.Group, models.Answer.group_id, user.id)
    return {**group_out(db, g, used.get(g.id)),
            "exams": [exam_out(db, e) for e in exams],
            "problems": [{"id": p.id, "title": p.title, "status": p.status,
                          "rubric_version": p.rubric_version, "tags": p.tags,
                          "archived": p.archived, "updated_at": p.updated_at.isoformat(),
                          **by_problem[p.id]} for p in problems]}
