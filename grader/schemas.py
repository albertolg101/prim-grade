"""Domain records. Models used as LLM structured output have no defaults (strict schema)."""

from typing import Literal

from pydantic import BaseModel

Confidence = Literal["high", "medium", "low"]
Mode = Literal["harness", "raw"]
Language = Literal["en", "es", "ru"]
RunStatus = Literal["running", "proposed", "review_required", "failed"]


# --- Rubric and exercise setup (GR-01–05) ---


class Criterion(BaseModel):
    id: str
    description: str
    max_points: float
    required_evidence: str
    full_credit: str
    partial_credit: str
    zero_credit: str


class Rubric(BaseModel):
    criteria: list[Criterion]
    carried_error_policy: str
    tolerances: str
    alternative_methods: str

    @property
    def total_points(self) -> float:
        return sum(c.max_points for c in self.criteria)


class SetupProposal(BaseModel):
    """LLM output of the exercise setup skill."""

    normalized_statement: str
    normalized_solution: str
    final_answers: list[str]
    assumptions: list[str]
    diagram_required: bool
    expected_forces: list[str]
    rubric: Rubric
    grading_plan: list[str]
    issues: list[str]


class Usage(BaseModel):
    input_tokens: int = 0
    cached_tokens: int = 0
    output_tokens: int = 0
    reasoning_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float | None = None


class Exercise(BaseModel):
    id: str
    title: str
    status: Literal["draft", "ready"]
    created_at: str
    setup_model: str
    setup_usage: Usage
    statement_text: str
    solution_text: str
    rubric_text: str
    originals: list[str]
    proposal: SetupProposal
    rubric: Rubric
    rubric_version: int
    rubric_errors: list[str]
    language: Language | None = None  # None: created before language selection existed


# --- Grading (GR-07/08) ---


class CriterionScore(BaseModel):
    criterion_id: str
    points: float | None
    source: str
    evidence: str
    reasoning: str
    confidence: Confidence


class HarnessAssessment(BaseModel):
    status: Literal["proposed", "review_required"]
    transcription: str
    interpretation: str
    diagram_observations: str
    criteria: list[CriterionScore]
    feedback: str
    review_reasons: list[str]


class RawAssessment(BaseModel):
    status: Literal["proposed", "review_required"]
    score: float | None
    comment: str


class Submission(BaseModel):
    id: str
    exercise_id: str
    label: str
    pages: list[str]
    created_at: str


class Run(BaseModel):
    id: str
    submission_id: str
    model: str
    mode: Mode
    language: Language | None = None
    status: RunStatus
    rubric_version: int
    max_points: float
    started_at: str
    finished_at: str | None = None
    duration_s: float | None = None
    usage: Usage | None = None
    total: float | None = None
    harness: HarnessAssessment | None = None
    raw: RawAssessment | None = None
    error: str | None = None


class ApprovedScore(BaseModel):
    criterion_id: str
    points: float


class Approval(BaseModel):
    from_run_id: str | None
    rubric_version: int
    scores: list[ApprovedScore]
    feedback: str
    total: float
    edited_criteria: list[str]
    approved_at: str
