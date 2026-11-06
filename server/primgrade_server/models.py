"""Database tables. Originals are rows in `files` whose bytes are never modified (PL-14, I4)."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

Json = JSON().with_variant(JSONB(), "postgresql")


def now() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return uuid4().hex


class Base(DeclarativeBase):
    pass


def ts(**kw) -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), default=now, **kw)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(16))  # pending | approved | rejected | deactivated
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    api_key_enc: Mapped[str | None] = mapped_column(Text)
    api_key_last4: Mapped[str | None] = mapped_column(String(4))
    theme: Mapped[str] = mapped_column(String(8), default="system")  # system | light | dark
    language: Mapped[str] = mapped_column(String(2), default="en", server_default="en")  # PL-37
    link_minutes: Mapped[int] = mapped_column(Integer, default=10)
    created_at: Mapped[datetime] = ts()


class Session(Base):
    __tablename__ = "sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = ts()
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class File(Base):
    __tablename__ = "files"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16))  # original | capture | scan
    path: Mapped[str] = mapped_column(Text)
    sha256: Mapped[str] = mapped_column(String(64))
    mime: Mapped[str] = mapped_column(String(32))
    size: Mapped[int] = mapped_column(Integer)
    original_name: Mapped[str] = mapped_column(String(255))
    derived_from: Mapped[str | None] = mapped_column(ForeignKey("files.id"))
    created_at: Mapped[datetime] = ts()


class Problem(Base):
    __tablename__ = "problems"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(8), default="draft")  # draft | ready
    language: Mapped[str] = mapped_column(String(2), default="en")
    statement_text: Mapped[str] = mapped_column(Text, default="")
    solution_text: Mapped[str] = mapped_column(Text, default="")
    rubric_text: Mapped[str] = mapped_column(Text, default="")
    proposal: Mapped[dict | None] = mapped_column(Json)  # grader SetupProposal
    pending_proposal: Mapped[dict | None] = mapped_column(Json)  # PL-18, kept or discarded
    pending_instruction: Mapped[str | None] = mapped_column(Text)
    rubric_version: Mapped[int] = mapped_column(Integer, default=0)  # 0: never accepted
    tags: Mapped[list[str]] = mapped_column(Json, default=list)  # PL-41, the teacher's own labels
    archived: Mapped[bool] = mapped_column(Boolean, default=False)  # PL-44: hidden by default
    # PL-43: set while the AI prepares the grader in the background; every tab reads it
    preparing_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    prepare_error: Mapped[str | None] = mapped_column(Text)  # the last preparation failed (I2)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # PL-54
    created_at: Mapped[datetime] = ts()
    updated_at: Mapped[datetime] = ts(onupdate=now)


class Tag(Base):
    """PL-41: a teacher's tag; it exists on its own, whether or not a problem carries it."""
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("owner_id", "key"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(40))  # the first spelling
    key: Mapped[str] = mapped_column(String(40))  # lower case: "Mechanics" = "mechanics"
    created_at: Mapped[datetime] = ts()


class ProblemFile(Base):
    __tablename__ = "problem_files"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    problem_id: Mapped[str] = mapped_column(ForeignKey("problems.id", ondelete="CASCADE"))
    file_id: Mapped[str] = mapped_column(ForeignKey("files.id"))
    role: Mapped[str] = mapped_column(String(16))  # statement | solution
    position: Mapped[int] = mapped_column(Integer)


class RubricVersion(Base):
    __tablename__ = "rubric_versions"
    __table_args__ = (UniqueConstraint("problem_id", "version"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    problem_id: Mapped[str] = mapped_column(ForeignKey("problems.id", ondelete="CASCADE"))
    version: Mapped[int] = mapped_column(Integer)
    proposal: Mapped[dict] = mapped_column(Json)
    skill: Mapped[str] = mapped_column(Text)  # grader instructions fixed at acceptance
    created_at: Mapped[datetime] = ts()


class Group(Base):
    __tablename__ = "groups"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # PL-54
    created_at: Mapped[datetime] = ts()


class Exam(Base):
    __tablename__ = "exams"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = ts()


class ExamProblem(Base):
    __tablename__ = "exam_problems"
    exam_id: Mapped[str] = mapped_column(
        ForeignKey("exams.id", ondelete="CASCADE"), primary_key=True
    )
    problem_id: Mapped[str] = mapped_column(ForeignKey("problems.id"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer)


class ExamGroup(Base):
    __tablename__ = "exam_groups"
    exam_id: Mapped[str] = mapped_column(
        ForeignKey("exams.id", ondelete="CASCADE"), primary_key=True
    )
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id"), primary_key=True)


class Answer(Base):
    __tablename__ = "answers"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    problem_id: Mapped[str] = mapped_column(ForeignKey("problems.id"), index=True)
    exam_id: Mapped[str | None] = mapped_column(ForeignKey("exams.id"))
    group_id: Mapped[str | None] = mapped_column(ForeignKey("groups.id"))
    student_name: Mapped[str] = mapped_column(String(200), default="")
    label: Mapped[str] = mapped_column(String(200), default="")
    source: Mapped[str] = mapped_column(String(8))  # teacher | student
    link_id: Mapped[str | None] = mapped_column(ForeignKey("upload_links.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)  # PL-31
    selected: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = ts()


class AnswerPage(Base):
    __tablename__ = "answer_pages"
    answer_id: Mapped[str] = mapped_column(
        ForeignKey("answers.id", ondelete="CASCADE"), primary_key=True
    )
    file_id: Mapped[str] = mapped_column(ForeignKey("files.id"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer)


class Run(Base):
    __tablename__ = "runs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    answer_id: Mapped[str] = mapped_column(ForeignKey("answers.id", ondelete="CASCADE"), index=True)
    rubric_version: Mapped[int] = mapped_column(Integer)
    model: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16))  # running | proposed | review_required | failed
    max_points: Mapped[float] = mapped_column(Float)
    total: Mapped[float | None] = mapped_column(Float)
    harness: Mapped[dict | None] = mapped_column(Json)
    language: Mapped[str | None] = mapped_column(String(2))  # PL-37, set when the run finishes
    usage: Mapped[dict | None] = mapped_column(Json)
    error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = ts()
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_s: Mapped[float | None] = mapped_column(Float)


class Approval(Base):
    __tablename__ = "approvals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    answer_id: Mapped[str] = mapped_column(
        ForeignKey("answers.id", ondelete="CASCADE"), unique=True
    )
    run_id: Mapped[str | None] = mapped_column(ForeignKey("runs.id"))
    rubric_version: Mapped[int] = mapped_column(Integer)
    scores: Mapped[list] = mapped_column(Json)
    feedback: Mapped[str] = mapped_column(Text)
    total: Mapped[float] = mapped_column(Float)
    edited_criteria: Mapped[list] = mapped_column(Json)
    ai_verdict: Mapped[str | None] = mapped_column(String(8))  # correct | wrong (PL-24)
    wrong_criteria: Mapped[list] = mapped_column(Json, default=list)
    wrong_reason: Mapped[str | None] = mapped_column(String(32))
    wrong_note: Mapped[str] = mapped_column(Text, default="")
    approved_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[datetime] = ts()


class UploadLink(Base):
    __tablename__ = "upload_links"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    token: Mapped[str] = mapped_column(String(64), unique=True)
    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"))
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id"))
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = ts()
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StudentBinding(Base):
    """PL-35: one browser cookie, one student name, per exam and group."""

    __tablename__ = "student_bindings"
    __table_args__ = (UniqueConstraint("exam_id", "group_id", "cookie_hash"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"))
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id"))
    cookie_hash: Mapped[str] = mapped_column(String(64))
    student_name: Mapped[str] = mapped_column(String(200))
    name_key: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = ts()


class AiCall(Base):
    """PL-32: every AI call, attributed for the cost views (PL-05, PL-33)."""

    __tablename__ = "ai_calls"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    purpose: Mapped[str] = mapped_column(String(8))  # setup | improve | grading
    problem_id: Mapped[str | None] = mapped_column(ForeignKey("problems.id"))
    exam_id: Mapped[str | None] = mapped_column(ForeignKey("exams.id"))
    group_id: Mapped[str | None] = mapped_column(ForeignKey("groups.id"))
    run_id: Mapped[str | None] = mapped_column(ForeignKey("runs.id"))
    model: Mapped[str] = mapped_column(String(64))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cached_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    reasoning_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float | None] = mapped_column(Float)  # estimated from prices.json
    created_at: Mapped[datetime] = ts()
