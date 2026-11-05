"""PL-15–19: drafts, generate the grader, edit it, improve it by instruction, accept versions."""

from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import func, select

from grader.schemas import SetupProposal
from grader.setup import (
    REVISE_INSTRUCTIONS,
    SETUP_INSTRUCTIONS,
    grader_instructions,
    revise_text,
    setup_text,
    validate_rubric,
)

from .. import ai, files, models
from ..config import MODEL
from ..deps import Config, Db, Teacher, owned

router = APIRouter(prefix="/api/problems", tags=["problems"])

Language = Literal["en", "es", "ru"]


class NewProblem(BaseModel):
    title: str = Field(min_length=1, max_length=200)


Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


def unique_tags(tags: list[str]) -> list[str]:
    """PL-41: the first spelling of a tag wins; 'Mechanics' and 'mechanics' are one tag."""
    seen: dict[str, str] = {}
    for t in tags:
        seen.setdefault(t.lower(), t)
    return list(seen.values())


class ProblemEdit(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    tags: list[Tag] | None = Field(default=None, max_length=20)
    statement_text: str | None = None
    solution_text: str | None = None
    rubric_text: str | None = None
    language: Language | None = None


class ProposalEdit(BaseModel):
    proposal: SetupProposal


class Instruction(BaseModel):
    instruction: str = Field(min_length=1, max_length=4000)


class Accept(BaseModel):
    issues_acknowledged: bool = False


def problem_files(db, problem_id: str) -> list[tuple[models.ProblemFile, models.File]]:
    return db.execute(
        select(models.ProblemFile, models.File)
        .join(models.File, models.File.id == models.ProblemFile.file_id)
        .where(models.ProblemFile.problem_id == problem_id)
        .order_by(models.ProblemFile.role.desc(), models.ProblemFile.position)  # statement first
    ).all()


def file_out(f: models.File) -> dict:
    return {"id": f.id, "kind": f.kind, "derived_from": f.derived_from, "name": f.original_name}


def rubric_errors(proposal: dict | None) -> list[str]:
    return validate_rubric(SetupProposal.model_validate(proposal).rubric) if proposal else []


def problem_out(db, p: models.Problem) -> dict:
    n_answers = db.scalar(
        select(func.count()).select_from(models.Answer).where(models.Answer.problem_id == p.id)
    )
    return {
        "id": p.id, "title": p.title, "status": p.status, "language": p.language,
        "statement_text": p.statement_text, "solution_text": p.solution_text,
        "rubric_text": p.rubric_text, "proposal": p.proposal,
        "pending_proposal": p.pending_proposal, "pending_instruction": p.pending_instruction,
        "rubric_version": p.rubric_version, "rubric_errors": rubric_errors(p.proposal),
        "tags": p.tags,
        "files": [{**file_out(f), "link_id": pf.id, "role": pf.role} for pf, f in
                  problem_files(db, p.id)],
        "answers": n_answers, "updated_at": p.updated_at.isoformat(),
    }


@router.get("")
def list_problems(db: Db, user: Teacher) -> list[dict]:
    rows = db.scalars(select(models.Problem).where(models.Problem.owner_id == user.id)
                      .order_by(models.Problem.updated_at.desc())).all()
    return [{"id": p.id, "title": p.title, "status": p.status, "rubric_version": p.rubric_version,
             "tags": p.tags, "updated_at": p.updated_at.isoformat()} for p in rows]


@router.get("/tags")
def list_tags(db: Db, user: Teacher) -> list[str]:
    """PL-41: the teacher's tags, used on a problem or not, for the autocomplete and the filters."""
    names = db.scalars(select(models.Tag.name).where(models.Tag.owner_id == user.id))
    return sorted(names, key=str.casefold)


def keep_tags(db, user: models.User, tags: list[str]) -> list[str]:
    """Store new tags; a tag the teacher already has keeps its first spelling on the problem too."""
    mine = db.scalars(select(models.Tag).where(models.Tag.owner_id == user.id))
    known = {t.key: t.name for t in mine}
    out = []
    for t in unique_tags(tags):
        key = t.lower()
        if key not in known:
            db.add(models.Tag(owner_id=user.id, name=t, key=key))
            known[key] = t
        out.append(known[key])
    return out


def create(db, user: models.User, body: NewProblem) -> models.Problem:
    p = models.Problem(owner_id=user.id, title=body.title.strip(),
                       language=user.language)
    db.add(p)
    db.flush()
    return p


@router.post("", status_code=201)
def new_problem(body: NewProblem, db: Db, user: Teacher) -> dict:
    p = create(db, user, body)  # PL-15: a title is enough for a draft
    db.commit()
    return problem_out(db, p)


@router.get("/{problem_id}")
def get_problem(problem_id: str, db: Db, user: Teacher) -> dict:
    return problem_out(db, owned(db, models.Problem, problem_id, user))


@router.patch("/{problem_id}")
def edit_problem(problem_id: str, body: ProblemEdit, db: Db, user: Teacher) -> dict:
    p = owned(db, models.Problem, problem_id, user)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v.strip() if k == "title" else keep_tags(db, user, v) if k == "tags" else v)
    db.commit()
    return problem_out(db, p)


@router.delete("/{problem_id}", status_code=204)
def delete_problem(problem_id: str, db: Db, user: Teacher) -> None:
    p = owned(db, models.Problem, problem_id, user)
    used = db.scalar(select(func.count()).select_from(models.Answer)
                     .where(models.Answer.problem_id == p.id))
    in_exam = db.scalar(select(func.count()).select_from(models.ExamProblem)
                        .where(models.ExamProblem.problem_id == p.id))
    if used or in_exam:
        raise HTTPException(409, "this problem has answers or is in an exam; it cannot be deleted")
    db.execute(models.AiCall.__table__.update().where(models.AiCall.problem_id == p.id)
               .values(problem_id=None))
    db.delete(p)
    db.commit()


@router.post("/{problem_id}/files")
async def add_files(
    problem_id: str,
    db: Db,
    user: Teacher,
    config: Config,
    role: Annotated[Literal["statement", "solution"], Form()],
    pages: Annotated[list[UploadFile], File()],
    captures: Annotated[list[UploadFile], File()] = [],  # noqa: B006 (FastAPI form default)
    capture_of: Annotated[list[int], Form()] = [],  # noqa: B006
) -> dict:
    p = owned(db, models.Problem, problem_id, user)
    checked = await files.read_pages(pages, captures, capture_of)
    start = db.scalar(select(func.count()).select_from(models.ProblemFile).where(
        models.ProblemFile.problem_id == p.id, models.ProblemFile.role == role))
    for i, f in enumerate(files.save_pages(db, config.storage_dir, user.id, checked)):
        db.add(models.ProblemFile(problem_id=p.id, file_id=f.id, role=role, position=start + i))
    db.commit()
    return problem_out(db, p)


@router.delete("/{problem_id}/files/{link_id}")
def remove_file(problem_id: str, link_id: int, db: Db, user: Teacher) -> dict:
    """Detaches the page from the problem; the stored original is kept (I4)."""
    p = owned(db, models.Problem, problem_id, user)
    pf = db.get(models.ProblemFile, link_id)
    if pf is None or pf.problem_id != p.id:
        raise HTTPException(404, "file not found on this problem")
    db.delete(pf)
    db.commit()
    return problem_out(db, p)


def _images(db, p: models.Problem) -> tuple[list[Path], int, int]:
    rows = problem_files(db, p.id)
    stmt = [Path(f.path) for pf, f in rows if pf.role == "statement"]
    sol = [Path(f.path) for pf, f in rows if pf.role == "solution"]
    return stmt + sol, len(stmt), len(sol)


@router.post("/{problem_id}/generate")
async def generate(problem_id: str, db: Db, user: Teacher, config: Config) -> dict:
    """PL-16: the AI prepares the problem (grader GR-01–05)."""
    p = owned(db, models.Problem, problem_id, user)
    images, n_stmt, n_sol = _images(db, p)
    if not (p.statement_text.strip() or n_stmt) or not (p.solution_text.strip() or n_sol):
        raise HTTPException(422, "add the statement and the reference solution (text or images)")
    llm = ai.llm_for(config, user)
    p.language = user.language  # PL-37: AI output follows the teacher's current language
    text = setup_text(p.title, p.statement_text, p.solution_text, p.rubric_text, n_stmt, n_sol,
                      p.language)
    try:
        out, usage = await llm(MODEL, SETUP_INSTRUCTIONS, text, images, SetupProposal)
    except Exception as e:  # provider failure: nothing is stored as a proposal (I2)
        db.rollback()
        raise HTTPException(
            502, f"the AI could not prepare the problem: {type(e).__name__}: {e}"
        ) from e
    ai.record(db, user.id, "setup", usage, problem_id=p.id)
    p.proposal, p.pending_proposal, p.pending_instruction = out.model_dump(), None, None
    p.status = "draft"
    db.commit()
    return problem_out(db, p)


@router.put("/{problem_id}/proposal")
def edit_proposal(problem_id: str, body: ProposalEdit, db: Db, user: Teacher) -> dict:
    """PL-17. Editing a ready problem returns it to draft; accepting makes the next version."""
    p = owned(db, models.Problem, problem_id, user)
    if p.proposal is None:
        raise HTTPException(409, "generate the grader first")
    p.proposal, p.status = body.proposal.model_dump(), "draft"
    db.commit()
    return problem_out(db, p)


@router.post("/{problem_id}/improve")
async def improve(problem_id: str, body: Instruction, db: Db, user: Teacher,
                  config: Config) -> dict:
    """PL-18: a revised proposal is kept aside until the teacher keeps or discards it."""
    p = owned(db, models.Problem, problem_id, user)
    if p.proposal is None:
        raise HTTPException(409, "generate the grader first")
    images, n_stmt, n_sol = _images(db, p)
    llm = ai.llm_for(config, user)
    p.language = user.language  # PL-37
    text = revise_text(p.title, p.statement_text, p.solution_text,
                       SetupProposal.model_validate(p.proposal), body.instruction, n_stmt, n_sol,
                       p.language)
    try:
        out, usage = await llm(MODEL, REVISE_INSTRUCTIONS, text, images, SetupProposal)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            502, f"the AI could not revise the problem: {type(e).__name__}: {e}"
        ) from e
    ai.record(db, user.id, "improve", usage, problem_id=p.id)
    p.pending_proposal, p.pending_instruction = out.model_dump(), body.instruction
    db.commit()
    return problem_out(db, p)


@router.post("/{problem_id}/improve/{choice}")
def keep_or_discard(problem_id: str, choice: Literal["keep", "discard"], db: Db,
                    user: Teacher) -> dict:
    p = owned(db, models.Problem, problem_id, user)
    if p.pending_proposal is None:
        raise HTTPException(409, "there is no revised proposal to keep or discard")
    if choice == "keep":
        p.proposal, p.status = p.pending_proposal, "draft"
    p.pending_proposal = p.pending_instruction = None
    db.commit()
    return problem_out(db, p)


@router.post("/{problem_id}/accept")
def accept(problem_id: str, body: Accept, db: Db, user: Teacher) -> dict:
    """PL-19: fix a rubric version and its grader instructions; the problem becomes ready."""
    p = owned(db, models.Problem, problem_id, user)
    if p.proposal is None:
        raise HTTPException(409, "generate the grader first")
    if p.status == "ready":
        return problem_out(db, p)
    errors = rubric_errors(p.proposal)
    if errors:
        raise HTTPException(422, "fix the rubric first: " + "; ".join(errors))
    if p.proposal["issues"] and not body.issues_acknowledged:
        raise HTTPException(409, "acknowledge the issues the AI raised before accepting")
    p.rubric_version += 1
    skill = grader_instructions(ai.exercise(p, p.proposal, p.rubric_version))
    db.add(models.RubricVersion(problem_id=p.id, version=p.rubric_version, proposal=p.proposal,
                                skill=skill))
    p.status = "ready"
    db.commit()
    return problem_out(db, p)
