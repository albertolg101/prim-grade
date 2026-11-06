"""PL-29–31, PL-35: the student upload page. No account; one browser cookie is bound to the first
student name per exam and group. This is a browser-session check, not proof of identity."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from .. import files, models, names
from ..deps import Config, Db
from ..grading import pages_of
from ..security import STUDENT_COOKIE, STUDENT_COOKIE_DAYS, new_token, token_hash
from .answers import add_answer
from .exams import exam_problems

router = APIRouter(prefix="/api/public", tags=["student"])

COOKIE_NOTE = ("This page sets one cookie so that this browser submits for one student only in "
               "this exam. It holds no name and no answers.")
CONFLICT = ("This browser has already submitted answers for a different student in this exam, so "
            "this submission was not sent. Ask your teacher to upload your answer for you.")


def _link(db, token: str) -> models.UploadLink:
    link = db.scalar(select(models.UploadLink).where(models.UploadLink.token == token))
    if link is None:
        raise HTTPException(404, "this upload link does not exist; check the address or QR code")
    return link


def _open(link: models.UploadLink) -> bool:
    return link.closed_at is None and link.expires_at > datetime.now(UTC)


@router.get("/links/{token}")
def open_page(token: str, request: Request, response: Response, db: Db, config: Config) -> dict:
    link = _link(db, token)
    exam, group = db.get(models.Exam, link.exam_id), db.get(models.Group, link.group_id)
    cookie = request.cookies.get(STUDENT_COOKIE)
    if not cookie:
        response.set_cookie(STUDENT_COOKIE, new_token(), max_age=STUDENT_COOKIE_DAYS * 86400,
                            httponly=True, samesite="lax", secure=config.secure_cookies,
                            path="/api/public")
    name, received = mine(db, link, cookie)
    return {"exam_title": exam.title, "group_name": group.name, "open": _open(link),
            "expires_at": link.expires_at.isoformat(), "cookie_note": COOKIE_NOTE,
            "problems": [{"id": p.id, "title": p.title}
                         for p in exam_problems(db, exam.id, active_only=True)],
            "student_name": name, "received": received}


def mine(db, link: models.UploadLink, cookie: str | None) -> tuple[str | None, list[dict]]:
    """PL-57: what this browser's student already sent for this exam and group, through any link,
    so a reopened page shows it. Only the browser bound to the name (PL-35) gets it."""
    binding = _binding(db, link, cookie)
    if not binding:
        return None, []
    a = models.Answer
    rows = db.scalars(_own_answers(link, binding.student_name).order_by(a.created_at)).all()
    return binding.student_name, [_receipt(db, x) for x in rows]


def _binding(db, link: models.UploadLink, cookie: str | None) -> models.StudentBinding | None:
    if not cookie:
        return None
    return db.scalar(select(models.StudentBinding).where(
        models.StudentBinding.exam_id == link.exam_id,
        models.StudentBinding.group_id == link.group_id,
        models.StudentBinding.cookie_hash == token_hash(cookie)))


def _own_answers(link: models.UploadLink, student_name: str):
    a = models.Answer
    return select(a).where(a.exam_id == link.exam_id, a.group_id == link.group_id,
                           a.source == "student", a.student_name == student_name)


def _receipt(db, a: models.Answer) -> dict:
    """PL-65: the page ids let the student open what was received (I4), through `own_page` only."""
    files = [f.id for f in pages_of(db, a.id)]
    return {"problem_id": a.problem_id, "version": a.version, "pages": len(files),
            "files": files, "received_at": a.created_at.isoformat()}


@router.get("/links/{token}/files/{file_id}")
def own_page(token: str, file_id: str, request: Request, db: Db):
    """PL-65: a received page, for the browser bound to the student who sent it (PL-35) and no one
    else; the link may be closed. Anything else is 404, so it reveals nothing about other
    answers."""
    link = _link(db, token)
    binding = _binding(db, link, request.cookies.get(STUDENT_COOKIE))
    owned = binding and db.scalar(
        select(models.AnswerPage.file_id)
        .where(models.AnswerPage.file_id == file_id,
               models.AnswerPage.answer_id.in_(
                   _own_answers(link, binding.student_name).with_only_columns(models.Answer.id))))
    f = owned and db.get(models.File, file_id)
    if not f:
        raise HTTPException(404, "page not found")
    return FileResponse(f.path, media_type=f.mime,
                        headers={"Cache-Control": "private, max-age=86400"})


@router.post("/links/{token}/answers", status_code=201)
async def submit(
    token: str,
    request: Request,
    db: Db,
    config: Config,
    student_name: Annotated[str, Form()],
    problem_id: Annotated[str, Form()],
    pages: Annotated[list[UploadFile], File()],
    captures: Annotated[list[UploadFile], File()] = [],  # noqa: B006
    capture_of: Annotated[list[int], Form()] = [],  # noqa: B006
) -> dict:
    link = _link(db, token)
    if not _open(link):  # PL-30: refused, not stored
        raise HTTPException(410, "this upload link is closed; ask your teacher for a new one")
    name = names.clean(student_name)
    if not name:
        raise HTTPException(422, "type your name")
    if problem_id not in {p.id for p in exam_problems(db, link.exam_id, active_only=True)}:
        raise HTTPException(422, "choose a problem of this exam")
    cookie = request.cookies.get(STUDENT_COOKIE)
    if not cookie:
        raise HTTPException(400, "this browser blocks the cookie this page needs; allow cookies "
                                 "and reload, or ask your teacher to upload your answer")
    checked = await files.read_pages(pages, captures, capture_of)  # validated, nothing stored yet
    ch = token_hash(cookie)
    # PL-35: the first submission binds the cookie; a concurrent second one cannot bind another
    db.execute(insert(models.StudentBinding).values(
        exam_id=link.exam_id, group_id=link.group_id, cookie_hash=ch, student_name=name,
        name_key=names.key(name), created_at=models.now()).on_conflict_do_nothing())
    binding = db.scalar(select(models.StudentBinding).where(
        models.StudentBinding.exam_id == link.exam_id,
        models.StudentBinding.group_id == link.group_id,
        models.StudentBinding.cookie_hash == ch).with_for_update())  # serialises this student
    if binding.name_key != names.key(name):
        db.commit()
        raise HTTPException(409, CONFLICT)  # never reveals the bound name
    exam = db.get(models.Exam, link.exam_id)
    problem = db.get(models.Problem, problem_id)
    saved = files.save_pages(db, config.storage_dir, exam.owner_id, checked)
    a = add_answer(db, problem, saved, source="student", student_name=binding.student_name,
                   exam_id=link.exam_id, group_id=link.group_id, link_id=link.id)
    db.commit()
    return {"received": True, **_receipt(db, a)}
