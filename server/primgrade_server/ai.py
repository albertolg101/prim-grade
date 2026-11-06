"""The platform's AI calls: one model (PL-34), each teacher's own key (PL-06), every call recorded
for the cost views (PL-32)."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from grader.llm import LLM, openai_llm
from grader.schemas import Exercise, SetupProposal, Usage

from . import models
from .config import MODEL, Settings
from .fake_llm import FakeLLM
from .security import decrypt


def llm_for(settings: Settings, user: models.User) -> LLM:
    if settings.llm == "fake":
        return FakeLLM()
    if not user.api_key_enc:
        raise HTTPException(409, "add your OpenAI API key in Settings before using AI")
    return openai_llm(decrypt(settings.secret_key, user.api_key_enc))


def record(
    db: Session,
    user_id: str,
    purpose: str,
    usage: Usage | None,
    problem_id: str | None = None,
    exam_id: str | None = None,
    group_id: str | None = None,
    run_id: str | None = None,
) -> None:
    """Called even when the output was invalid: those tokens were spent."""
    u = usage or Usage()
    db.add(models.AiCall(
        user_id=user_id, purpose=purpose, problem_id=problem_id, exam_id=exam_id,
        group_id=group_id, run_id=run_id, model=MODEL, input_tokens=u.input_tokens,
        cached_tokens=u.cached_tokens, output_tokens=u.output_tokens,
        reasoning_tokens=u.reasoning_tokens, total_tokens=u.total_tokens, cost_usd=u.cost_usd,
    ))


def exercise(problem: models.Problem, proposal: dict, version: int) -> Exercise:
    """The grader's view of a problem at one rubric version."""
    p = SetupProposal.model_validate(proposal)
    return Exercise(
        id=problem.id, title=problem.title, status="ready",
        created_at=problem.created_at.isoformat(), setup_model=MODEL, setup_usage=Usage(),
        statement_text=problem.statement_text, solution_text=problem.solution_text,
        rubric_text=problem.rubric_text, originals=[], proposal=p, rubric=p.rubric,
        rubric_version=version, rubric_errors=[], language=problem.language,
    )
