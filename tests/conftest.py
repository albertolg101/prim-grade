import asyncio

import pytest

from grader.schemas import (
    Criterion,
    CriterionScore,
    Exercise,
    HarnessAssessment,
    RawAssessment,
    Rubric,
    Run,
    SetupProposal,
    Submission,
    Usage,
)

PNG = b"\x89PNG\r\n\x1a\nfake-image-bytes"


def rubric() -> Rubric:
    return Rubric(
        criteria=[
            Criterion(
                id="C1",
                description="Free-body diagram",
                max_points=3,
                required_evidence="diagram",
                full_credit="all forces",
                partial_credit="one missing",
                zero_credit="none",
            ),
            Criterion(
                id="C2",
                description="Newton II and result",
                max_points=4,
                required_evidence="equation",
                full_credit="a = 0.69 m/s^2",
                partial_credit="carried error",
                zero_credit="none",
            ),
        ],
        carried_error_policy="penalise once",
        tolerances="2 significant figures",
        alternative_methods="any valid axes",
    )


def proposal(issues: list[str] | None = None) -> SetupProposal:
    return SetupProposal(
        normalized_statement="Pallet 80 kg pulled with 350 N at 30 deg, mu=0.4. Find a.",
        normalized_solution="a = (F cos a - mu(mg - F sin a))/m",
        final_answers=["a ≈ 0.69 m/s^2"],
        assumptions=["g = 10 m/s^2"],
        diagram_required=True,
        expected_forces=["mg", "N", "F", "friction"],
        rubric=rubric(),
        grading_plan=["check diagram", "check equations"],
        issues=issues or [],
    )


def harness(points=(3, 2), status="proposed", reasons=None) -> HarnessAssessment:
    return HarnessAssessment(
        status=status,
        transcription="Ox: F sin a - Fmp = ma",
        interpretation="uses sin instead of cos",
        diagram_observations="none",
        criteria=[
            CriterionScore(
                criterion_id=cid,
                points=p,
                source="page 1",
                evidence="seen",
                reasoning="r",
                confidence="medium",
            )
            for cid, p in zip(["C1", "C2"], points, strict=True)
        ],
        feedback="Use cos for the horizontal component.",
        review_reasons=reasons or [],
    )


class FakeLLM:
    """Records calls and concurrency; returns canned outputs per schema."""

    def __init__(self, harness_out=None, raw_out=None, fail_models=(), delay=0.0):
        self.setup_out = proposal()
        self.harness_out = harness_out or harness()
        self.raw_out = raw_out or RawAssessment(status="proposed", score=5, comment="ok")
        self.fail_models = set(fail_models)
        self.delay = delay
        self.calls = []
        self.active = self.max_active = 0

    async def __call__(self, model, instructions, text, images, schema):
        self.calls.append(
            {
                "model": model,
                "text": text,
                "instructions": instructions,
                "images": images,
                "schema": schema,
            }
        )
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        try:
            await asyncio.sleep(self.delay)
            if model in self.fail_models:
                raise RuntimeError("provider down")
            out = {
                SetupProposal: self.setup_out,
                HarnessAssessment: self.harness_out,
                RawAssessment: self.raw_out,
            }[schema]
            return out.model_copy(deep=True), Usage(
                input_tokens=100, cached_tokens=20, output_tokens=50, total_tokens=150
            )
        finally:
            self.active -= 1


def exercise() -> Exercise:
    p = proposal()
    return Exercise(
        id="ex1", title="P3 V1", status="ready", created_at="2026-11-05T00:00:00+00:00",
        setup_model="m-small", setup_usage=Usage(), statement_text="pallet", solution_text="a=...",
        rubric_text="", originals=[], proposal=p, rubric=p.rubric, rubric_version=1,
        rubric_errors=[],
    )


def submission(sid: str = "sub1", label: str = "S0") -> Submission:
    return Submission(id=sid, exercise_id="ex1", label=label, pages=["p1.png"],
                      created_at="2026-11-05T00:00:00+00:00")


def run(rid: str, sid: str = "sub1", model: str = "m-small", mode="harness", language="en") -> Run:
    return Run(id=rid, submission_id=sid, model=model, mode=mode, language=language,
               status="running", rubric_version=1, max_points=7,
               started_at="2026-11-05T00:00:00+00:00")


@pytest.fixture
def fake():
    return FakeLLM()
