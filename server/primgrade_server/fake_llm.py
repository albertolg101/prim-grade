"""PRIMGRADE_LLM=fake: a deterministic model for UI walks and demos; never the default."""

import re

from grader.llm import cost_usd, load_prices
from grader.schemas import (
    Criterion,
    CriterionScore,
    HarnessAssessment,
    RawAssessment,
    Rubric,
    SetupProposal,
    Usage,
)


def _proposal(text: str) -> SetupProposal:
    title = text.splitlines()[0].removeprefix("Exercise title: ") if text else "Exercise"
    return SetupProposal(
        normalized_statement=f"{title}: statement as read from the sources (fake model).",
        normalized_solution="Reference solution as read from the sources (fake model).",
        final_answers=["a = 0.69 m/s^2"],
        assumptions=["g = 10 m/s^2"],
        diagram_required=True,
        expected_forces=["weight mg", "normal N", "applied F", "friction f"],
        rubric=Rubric(
            criteria=[
                Criterion(id="C1", description="Free-body diagram", max_points=3,
                          required_evidence="diagram with all forces",
                          full_credit="all four forces, correct directions",
                          partial_credit="one force missing or misdirected",
                          zero_credit="no usable diagram"),
                Criterion(id="C2", description="Newton's second law and result", max_points=4,
                          required_evidence="equations and final value",
                          full_credit="correct equations and a = 0.69 m/s^2",
                          partial_credit="correct method with a carried error",
                          zero_credit="no relevant equation"),
            ],
            carried_error_policy="Penalise an earlier mistake once only.",
            tolerances="Two significant figures; units required.",
            alternative_methods="Any valid choice of axes.",
        ),
        grading_plan=["Check the diagram", "Check the equations", "Check the final value"],
        issues=[],
    )


class FakeLLM:
    async def __call__(self, model, instructions, text, images, schema):
        usage = Usage(input_tokens=1200, cached_tokens=200, output_tokens=300, total_tokens=1500)
        usage.cost_usd = cost_usd(model, usage, load_prices())  # same costing as the real client
        if schema is SetupProposal:
            if "Current proposal (JSON):" in text:
                current = text.split("Current proposal (JSON):\n", 1)[1].split("\n\nTeacher", 1)[0]
                p = SetupProposal.model_validate_json(current)
                p.assumptions = [*p.assumptions, "Revised by the teacher's instruction (fake)."]
                return p, usage
            return _proposal(text), usage
        if schema is HarnessAssessment:
            # one score per criterion of the real rubric: full marks on the first, half on the rest
            crit = re.findall(r"^### (\S+) — .*\(max ([\d.]+)\)$", instructions, re.M)
            return HarnessAssessment(
                status="proposed",
                transcription="F cos30 - mu (mg - F sin30) = ma [fake]",
                interpretation="Uses Newton's second law along x (fake model).",
                diagram_observations="Four forces drawn (fake model).",
                criteria=[
                    CriterionScore(criterion_id=cid, points=float(mx) if i == 0 else float(mx) / 2,
                                   source="page 1", evidence="seen on page 1 (fake model)",
                                   reasoning="Fake model reasoning.",
                                   confidence="high" if i == 0 else "medium")
                    for i, (cid, mx) in enumerate(crit)
                ],
                feedback="Check the horizontal component of F (fake model).",
                review_reasons=[],
            ), usage
        return RawAssessment(status="proposed", score=5, comment="fake"), usage
