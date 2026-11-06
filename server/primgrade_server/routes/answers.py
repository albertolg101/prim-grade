"""PL-20–24: add answers, grade them, review one at a time, approve with feedback on the AI."""

from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from grader.schemas import SetupProposal

from .. import ai, files, models, names
from ..config import MODEL
from ..deps import Config, Db, Teacher, owned
from ..grading import grade_runs, pages_of
from .problems import file_out

router = APIRouter(prefix="/api", tags=["answers"])


def add_answer(db: Session, problem: models.Problem, saved: list[models.File], *, source: str,
               student_name: str = "", label: str = "", exam_id: str | None = None,
               group_id: str | None = None, link_id: str | None = None) -> models.Answer:
    """PL-31: a repeat upload by the same student for one problem in one exam and group is a new
    version; earlier versions are kept, and the newest is selected for grading."""
    name, version = names.clean(student_name), 1
    if name and exam_id and group_id:
        same = (models.Answer.problem_id == problem.id, models.Answer.exam_id == exam_id,
                models.Answer.group_id == group_id,
                func.lower(models.Answer.student_name) == names.key(name))
        version = (db.scalar(select(func.max(models.Answer.version)).where(*same)) or 0) + 1
        db.execute(models.Answer.__table__.update().where(*same).values(selected=False))
    a = models.Answer(problem_id=problem.id, exam_id=exam_id, group_id=group_id,
                      student_name=name, label=label.strip(), source=source, link_id=link_id,
                      version=version, selected=True)
    db.add(a)
    db.flush()
    for i, f in enumerate(saved):
        db.add(models.AnswerPage(answer_id=a.id, file_id=f.id, position=i))
    return a


def state(db: Session, a: models.Answer) -> dict:
    run = db.scalar(select(models.Run).where(models.Run.answer_id == a.id)
                    .order_by(models.Run.started_at.desc()).limit(1))
    appr = db.scalar(select(models.Approval).where(models.Approval.answer_id == a.id))
    return {
        "state": "approved" if appr else (run.status if run else "not_graded"),
        "proposed_total": run.total if run else None,
        "max_points": run.max_points if run else None,
        "approved_total": appr.total if appr else None,
    }


def answer_row(db: Session, a: models.Answer) -> dict:
    return {"id": a.id, "problem_id": a.problem_id, "exam_id": a.exam_id, "group_id": a.group_id,
            "student_name": a.student_name, "label": a.label, "source": a.source,
            "version": a.version, "selected": a.selected, "created_at": a.created_at.isoformat(),
            **state(db, a)}


def owned_answer(db: Session, answer_id: str, user: models.User) -> tuple[models.Answer,
                                                                          models.Problem]:
    a = db.get(models.Answer, answer_id)
    p = db.get(models.Problem, a.problem_id) if a else None
    if a is None or p.owner_id != user.id:
        raise HTTPException(404, "answer not found")
    return a, p


def check_exam_group(db: Session, user, problem_id: str, exam_id: str | None,
                     group_id: str | None) -> None:
    """An exam needs its group; a group alone (PL-46) must be one of the teacher's groups."""
    if exam_id and not group_id:
        raise HTTPException(422, "give the group for that exam")
    if group_id:
        owned(db, models.Group, group_id, user)
    if exam_id:
        owned(db, models.Exam, exam_id, user)
        if not db.get(models.ExamProblem, (exam_id, problem_id)):
            raise HTTPException(422, "this problem is not in that exam")
        if not db.get(models.ExamGroup, (exam_id, group_id)):
            raise HTTPException(422, "that group is not assigned to the exam")


@router.post("/problems/{problem_id}/answers", status_code=201)
async def upload_answer(
    problem_id: str,
    db: Db,
    user: Teacher,
    config: Config,
    pages: Annotated[list[UploadFile], File()],
    captures: Annotated[list[UploadFile], File()] = [],  # noqa: B006
    capture_of: Annotated[list[int], Form()] = [],  # noqa: B006
    label: Annotated[str, Form()] = "",
    student_name: Annotated[str, Form()] = "",
    exam_id: Annotated[str | None, Form()] = None,
    group_id: Annotated[str | None, Form()] = None,
) -> dict:
    """PL-20 (and teacher upload on a student's behalf, PL-35)."""
    p = owned(db, models.Problem, problem_id, user)
    check_exam_group(db, user, p.id, exam_id, group_id)
    checked = await files.read_pages(pages, captures, capture_of)
    saved = files.save_pages(db, config.storage_dir, user.id, checked)
    a = add_answer(db, p, saved, source="teacher", student_name=student_name, label=label,
                   exam_id=exam_id, group_id=group_id)
    db.commit()
    return answer_row(db, a)


@router.get("/problems/{problem_id}/answers")
def list_answers(problem_id: str, db: Db, user: Teacher) -> list[dict]:
    p = owned(db, models.Problem, problem_id, user)
    rows = db.scalars(select(models.Answer).where(models.Answer.problem_id == p.id)
                      .order_by(models.Answer.created_at.desc())).all()  # PL-45: newest first
    return [answer_row(db, a) for a in rows]


class AnswerEdit(BaseModel):
    student_name: str | None = Field(default=None, max_length=200)
    label: str | None = Field(default=None, max_length=200)
    group_id: str | None = None  # sent as null: no group


@router.patch("/answers/{answer_id}")
def edit_answer(answer_id: str, body: AnswerEdit, db: Db, user: Teacher) -> dict:
    """PL-53: the label can always change. The name and the group only on the teacher's own upload
    outside an exam: a student's typed name is the trace of who sent it (PL-31, PL-35), and in an
    exam the name and group decide the student's versions and the exam-and-group pairing."""
    a, _ = owned_answer(db, answer_id, user)
    fixed = a.source == "student" or a.exam_id is not None
    if body.label is not None:
        a.label = body.label.strip()
    if body.student_name is not None and names.clean(body.student_name) != a.student_name:
        if fixed:
            raise HTTPException(409, "the name of a student's upload or an exam answer is kept")
        a.student_name = names.clean(body.student_name)
    if "group_id" in body.model_fields_set and body.group_id != a.group_id:
        if fixed:
            raise HTTPException(409, "the group of a student's upload or an exam answer is kept")
        if body.group_id:
            owned(db, models.Group, body.group_id, user)
        a.group_id = body.group_id
    db.commit()
    return answer_row(db, a)


@router.get("/answers/{answer_id}")
def get_answer(answer_id: str, db: Db, user: Teacher) -> dict:
    a, p = owned_answer(db, answer_id, user)
    runs = db.scalars(select(models.Run).where(models.Run.answer_id == a.id)
                      .order_by(models.Run.started_at.desc())).all()
    appr = db.scalar(select(models.Approval).where(models.Approval.answer_id == a.id))
    version = runs[0].rubric_version if runs else p.rubric_version
    rv = db.scalar(select(models.RubricVersion).where(
        models.RubricVersion.problem_id == p.id, models.RubricVersion.version == version))
    versions = []
    if a.student_name and a.exam_id:
        versions = [{"id": v.id, "version": v.version, "selected": v.selected,
                     "created_at": v.created_at.isoformat()} for v in db.scalars(
            select(models.Answer).where(
                models.Answer.problem_id == a.problem_id, models.Answer.exam_id == a.exam_id,
                models.Answer.group_id == a.group_id,
                func.lower(models.Answer.student_name) == a.student_name.lower())
            .order_by(models.Answer.version))]
    return {
        **answer_row(db, a), "problem_title": p.title,
        "pages": [file_out(f) for f in pages_of(db, a.id)],
        "rubric_version": version, "rubric": rv.proposal["rubric"] if rv else None,
        "runs": [{"id": r.id, "status": r.status, "total": r.total, "max_points": r.max_points,
                  "rubric_version": r.rubric_version, "harness": r.harness, "error": r.error,
                  "language": r.language,
                  "usage": r.usage, "started_at": r.started_at.isoformat(),
                  "finished_at": r.finished_at.isoformat() if r.finished_at else None}
                 for r in runs],
        "approval": None if appr is None else {
            "run_id": appr.run_id, "rubric_version": appr.rubric_version, "scores": appr.scores,
            "feedback": appr.feedback, "total": appr.total,
            "edited_criteria": appr.edited_criteria, "ai_verdict": appr.ai_verdict,
            "wrong_criteria": appr.wrong_criteria, "wrong_reason": appr.wrong_reason,
            "wrong_note": appr.wrong_note, "approved_at": appr.approved_at.isoformat()},
        "versions": versions,
    }


class GradeRequest(BaseModel):
    answer_ids: list[str] = Field(min_length=1, max_length=300)


@router.post("/answers/grade", status_code=202)
def grade(body: GradeRequest, db: Db, user: Teacher, config: Config,
          tasks: BackgroundTasks) -> list[dict]:
    """PL-21: one draft per answer; progress shows as each run finishes."""
    ai.llm_for(config, user)  # refuse at once when there is no key (PL-06)
    run_ids, out = [], []
    for answer_id in dict.fromkeys(body.answer_ids):
        a, p = owned_answer(db, answer_id, user)
        if p.status != "ready":
            raise HTTPException(409, f"accept the grader of “{p.title}” before grading")
        rv = db.scalar(select(models.RubricVersion).where(
            models.RubricVersion.problem_id == p.id,
            models.RubricVersion.version == p.rubric_version))
        total = SetupProposal.model_validate(rv.proposal).rubric.total_points
        r = models.Run(answer_id=a.id, rubric_version=p.rubric_version, model=MODEL,
                       status="running", max_points=total)
        db.add(r)
        db.flush()
        run_ids.append(r.id)
        out.append({"answer_id": a.id, "run_id": r.id})
    db.commit()
    tasks.add_task(grade_runs, config, user.id, run_ids)
    return out


class Score(BaseModel):
    criterion_id: str
    points: float


class ApprovalIn(BaseModel):
    run_id: str | None = None
    scores: list[Score]
    feedback: str = Field(max_length=4000)
    ai_verdict: Literal["correct", "wrong"] | None = None
    wrong_criteria: list[str] = []
    wrong_reason: Literal["misread_handwriting", "wrong_physics", "rubric_misapplied",
                          "other"] | None = None
    wrong_note: str = Field(default="", max_length=2000)


@router.post("/answers/{answer_id}/approve")
def approve(answer_id: str, body: ApprovalIn, db: Db, user: Teacher) -> dict:
    """PL-23 and PL-24. The AI proposal is kept unchanged beside the approved grade."""
    a, p = owned_answer(db, answer_id, user)
    run = None
    if body.run_id:
        run = db.get(models.Run, body.run_id)
        if run is None or run.answer_id != a.id:
            raise HTTPException(404, "run not found for this answer")
        if run.status == "running":
            raise HTTPException(409, "wait for the AI to finish before approving")
    version = run.rubric_version if run else p.rubric_version
    rv = db.scalar(select(models.RubricVersion).where(
        models.RubricVersion.problem_id == p.id, models.RubricVersion.version == version))
    if rv is None:
        raise HTTPException(409, "accept the grader before approving a grade")
    limits = {c["id"]: c["max_points"] for c in rv.proposal["rubric"]["criteria"]}
    given = {s.criterion_id: s.points for s in body.scores}
    if sorted(given) != sorted(limits) or len(given) != len(body.scores):
        raise HTTPException(422, "give exactly one score for every rubric criterion")
    for cid, pts in given.items():
        if not 0 <= pts <= limits[cid]:
            raise HTTPException(422, f"{cid}: {pts:g} is outside 0–{limits[cid]:g}")
    if run is not None and run.status in ("proposed", "review_required"):
        if body.ai_verdict is None:
            raise HTTPException(422, "say whether the AI was correct or wrong")
    if body.ai_verdict == "wrong" and (body.wrong_reason is None or
                                       not (body.wrong_criteria or body.wrong_note.strip())):
        raise HTTPException(422, "say why the AI was wrong: a reason and the criteria or a note")
    if any(c not in limits for c in body.wrong_criteria):
        raise HTTPException(422, "wrong criteria must be rubric criteria")
    proposed = {}
    if run is not None and run.harness:
        proposed = {c["criterion_id"]: c["points"] for c in run.harness["criteria"]}
    edited = sorted(c for c in limits if proposed.get(c) != given[c]) if proposed else []
    appr = db.scalar(select(models.Approval).where(models.Approval.answer_id == a.id))
    if appr is None:
        appr = models.Approval(answer_id=a.id, approved_by=user.id)
        db.add(appr)
    appr.run_id, appr.rubric_version = body.run_id, version
    appr.scores = [s.model_dump() for s in body.scores]
    appr.feedback, appr.total, appr.edited_criteria = body.feedback, sum(given.values()), edited
    appr.ai_verdict, appr.wrong_criteria = body.ai_verdict, body.wrong_criteria
    appr.wrong_reason = body.wrong_reason if body.ai_verdict == "wrong" else None
    appr.wrong_note = body.wrong_note if body.ai_verdict == "wrong" else ""
    appr.approved_by, appr.approved_at = user.id, models.now()
    db.commit()
    return get_answer(answer_id, db, user)


@router.post("/answers/{answer_id}/select")
def select_version(answer_id: str, db: Db, user: Teacher) -> dict:
    """PL-31: the teacher chooses which version of a student's answer to grade."""
    a, _ = owned_answer(db, answer_id, user)
    if a.exam_id and a.student_name:
        db.execute(models.Answer.__table__.update().where(
            models.Answer.problem_id == a.problem_id, models.Answer.exam_id == a.exam_id,
            models.Answer.group_id == a.group_id,
            func.lower(models.Answer.student_name) == a.student_name.lower()
        ).values(selected=False))
    a.selected = True
    db.commit()
    return get_answer(answer_id, db, user)


@router.get("/files/{file_id}")
def get_file(file_id: str, db: Db, user: Teacher):
    from fastapi.responses import FileResponse

    f = db.get(models.File, file_id)
    if f is None or f.owner_id != user.id:
        raise HTTPException(404, "file not found")
    return FileResponse(f.path, media_type=f.mime,
                        headers={"Cache-Control": "private, max-age=86400"})
