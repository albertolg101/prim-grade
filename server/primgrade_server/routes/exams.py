"""PL-26–28, PL-30: exams, their problems and groups, answers per exam and group, upload links."""

import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from .. import models
from ..deps import Config, Db, Teacher, owned
from .answers import answer_row
from .problems import NewProblem, create

router = APIRouter(prefix="/api", tags=["exams"])


class ExamIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class NewExam(ExamIn):
    problem_ids: list[str] = []  # PL-52: existing problems, in exam order


class AddProblem(BaseModel):
    problem_id: str


class Order(BaseModel):
    problem_ids: list[str]


class Groups(BaseModel):
    group_ids: list[str]


class LinkIn(BaseModel):
    minutes: int | None = Field(default=None, ge=1, le=240)


def exam_problems(db, exam_id: str) -> list[models.Problem]:
    return list(db.scalars(
        select(models.Problem).join(models.ExamProblem,
                                    models.ExamProblem.problem_id == models.Problem.id)
        .where(models.ExamProblem.exam_id == exam_id).order_by(models.ExamProblem.position)))


def exam_out(db, e: models.Exam) -> dict:
    groups = db.scalars(select(models.Group).join(models.ExamGroup,
                                                  models.ExamGroup.group_id == models.Group.id)
                        .where(models.ExamGroup.exam_id == e.id).order_by(models.Group.name)).all()
    return {"id": e.id, "title": e.title, "created_at": e.created_at.isoformat(),
            "problems": [{"id": p.id, "title": p.title, "status": p.status}
                         for p in exam_problems(db, e.id)],
            "groups": [{"id": g.id, "name": g.name} for g in groups]}


@router.get("/exams")
def list_exams(db: Db, user: Teacher) -> list[dict]:
    rows = db.scalars(select(models.Exam).where(models.Exam.owner_id == user.id)
                      .order_by(models.Exam.created_at.desc())).all()
    return [exam_out(db, e) for e in rows]


@router.post("/exams", status_code=201)
def new_exam(body: NewExam, db: Db, user: Teacher) -> dict:
    if len(set(body.problem_ids)) != len(body.problem_ids):
        raise HTTPException(422, "a problem can be in an exam only once")
    for pid in body.problem_ids:
        owned(db, models.Problem, pid, user)
    e = models.Exam(owner_id=user.id, title=body.title.strip())
    db.add(e)
    db.flush()
    for i, pid in enumerate(body.problem_ids):
        db.add(models.ExamProblem(exam_id=e.id, problem_id=pid, position=i))
    db.commit()
    return exam_out(db, e)


@router.get("/exams/{exam_id}")
def get_exam(exam_id: str, db: Db, user: Teacher) -> dict:
    return exam_out(db, owned(db, models.Exam, exam_id, user))


@router.patch("/exams/{exam_id}")
def rename_exam(exam_id: str, body: ExamIn, db: Db, user: Teacher) -> dict:
    e = owned(db, models.Exam, exam_id, user)
    e.title = body.title.strip()
    db.commit()
    return exam_out(db, e)


def _append(db, exam_id: str, problem_id: str) -> None:
    if db.get(models.ExamProblem, (exam_id, problem_id)):
        raise HTTPException(409, "this problem is already in the exam")
    n = db.scalar(select(func.count()).select_from(models.ExamProblem)
                  .where(models.ExamProblem.exam_id == exam_id))
    db.add(models.ExamProblem(exam_id=exam_id, problem_id=problem_id, position=n))


@router.post("/exams/{exam_id}/problems")
def add_problem(exam_id: str, body: AddProblem, db: Db, user: Teacher) -> dict:
    e = owned(db, models.Exam, exam_id, user)
    owned(db, models.Problem, body.problem_id, user)
    _append(db, e.id, body.problem_id)
    db.commit()
    return exam_out(db, e)


@router.post("/exams/{exam_id}/problems/new", status_code=201)
def new_problem_in_exam(exam_id: str, body: NewProblem, db: Db, user: Teacher) -> dict:
    """PL-26, AC-P10: a problem created from inside an exam is added to it."""
    e = owned(db, models.Exam, exam_id, user)
    p = create(db, user, body)
    _append(db, e.id, p.id)
    db.commit()
    return {**exam_out(db, e), "created_problem_id": p.id}


@router.delete("/exams/{exam_id}/problems/{problem_id}")
def remove_problem(exam_id: str, problem_id: str, db: Db, user: Teacher) -> dict:
    e = owned(db, models.Exam, exam_id, user)
    link = db.get(models.ExamProblem, (e.id, problem_id))
    if link is None:
        raise HTTPException(404, "this problem is not in the exam")
    if db.scalar(select(func.count()).select_from(models.Answer).where(
            models.Answer.exam_id == e.id, models.Answer.problem_id == problem_id)):
        raise HTTPException(409, "students have answered this problem in this exam")
    db.delete(link)
    db.flush()
    for i, p in enumerate(exam_problems(db, e.id)):
        db.get(models.ExamProblem, (e.id, p.id)).position = i
    db.commit()
    return exam_out(db, e)


@router.put("/exams/{exam_id}/problems")
def reorder(exam_id: str, body: Order, db: Db, user: Teacher) -> dict:
    e = owned(db, models.Exam, exam_id, user)
    current = [p.id for p in exam_problems(db, e.id)]
    if sorted(current) != sorted(body.problem_ids):
        raise HTTPException(422, "the new order must list exactly the exam's problems")
    for i, pid in enumerate(body.problem_ids):
        db.get(models.ExamProblem, (e.id, pid)).position = i
    db.commit()
    return exam_out(db, e)


@router.put("/exams/{exam_id}/groups")
def set_groups(exam_id: str, body: Groups, db: Db, user: Teacher) -> dict:
    e = owned(db, models.Exam, exam_id, user)
    wanted = set(body.group_ids)
    for gid in wanted:
        owned(db, models.Group, gid, user)
    current = {g.group_id: g for g in db.scalars(
        select(models.ExamGroup).where(models.ExamGroup.exam_id == e.id))}
    for gid in set(current) - wanted:
        if db.scalar(select(func.count()).select_from(models.Answer).where(
                models.Answer.exam_id == e.id, models.Answer.group_id == gid)):
            raise HTTPException(409, "a group with answers in this exam cannot be removed")
        db.delete(current[gid])
    for gid in wanted - set(current):
        db.add(models.ExamGroup(exam_id=e.id, group_id=gid))
    db.commit()
    return exam_out(db, e)


def _exam_group(db, user, exam_id: str, group_id: str) -> tuple[models.Exam, models.Group]:
    e = owned(db, models.Exam, exam_id, user)
    g = owned(db, models.Group, group_id, user)
    if not db.get(models.ExamGroup, (e.id, g.id)):
        raise HTTPException(404, "that group is not assigned to this exam")
    return e, g


@router.get("/exams/{exam_id}/groups/{group_id}/answers")
def exam_group_answers(exam_id: str, group_id: str, db: Db, user: Teacher) -> dict:
    """PL-27: answers per problem and per student for one exam and group."""
    e, g = _exam_group(db, user, exam_id, group_id)
    rows = db.scalars(select(models.Answer).where(
        models.Answer.exam_id == e.id, models.Answer.group_id == g.id)
        .order_by(models.Answer.student_name, models.Answer.version)).all()
    return {"exam": exam_out(db, e), "group": {"id": g.id, "name": g.name},
            "answers": [answer_row(db, a) for a in rows]}


def link_out(link: models.UploadLink, config) -> dict:
    now = datetime.now(UTC)
    st = "closed" if link.closed_at else ("expired" if link.expires_at <= now else "open")
    return {"id": link.id, "url": f"{config.public_base_url}/s/{link.token}", "state": st,
            "created_at": link.created_at.isoformat(), "expires_at": link.expires_at.isoformat(),
            "closed_at": link.closed_at.isoformat() if link.closed_at else None}


@router.get("/exams/{exam_id}/groups/{group_id}/links")
def list_links(exam_id: str, group_id: str, db: Db, user: Teacher, config: Config) -> list[dict]:
    e, g = _exam_group(db, user, exam_id, group_id)
    rows = db.scalars(select(models.UploadLink).where(
        models.UploadLink.exam_id == e.id, models.UploadLink.group_id == g.id)
        .order_by(models.UploadLink.created_at.desc())).all()
    return [link_out(x, config) for x in rows]


@router.post("/exams/{exam_id}/groups/{group_id}/links", status_code=201)
def open_link(exam_id: str, group_id: str, body: LinkIn, db: Db, user: Teacher,
              config: Config) -> dict:
    """PL-28: the lifetime defaults to the teacher's setting (PL-08)."""
    e, g = _exam_group(db, user, exam_id, group_id)
    if not exam_problems(db, e.id):
        raise HTTPException(409, "add at least one problem to the exam first")
    minutes = body.minutes or user.link_minutes
    link = models.UploadLink(token=secrets.token_urlsafe(24), exam_id=e.id, group_id=g.id,
                             created_by=user.id,
                             expires_at=datetime.now(UTC) + timedelta(minutes=minutes))
    db.add(link)
    db.commit()
    return link_out(link, config)


@router.post("/links/{link_id}/close")
def close_link(link_id: str, db: Db, user: Teacher, config: Config) -> dict:
    link = db.get(models.UploadLink, link_id)
    if link is None or owned(db, models.Exam, link.exam_id, user) is None:
        raise HTTPException(404, "link not found")
    if link.closed_at is None:
        link.closed_at = datetime.now(UTC)
        db.commit()
    return link_out(link, config)
