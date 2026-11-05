"""PT-02/PT-03: validation of model proposals, batch grading and cost accounting."""

import asyncio
from pathlib import Path

import pytest

from grader.grading import InvalidAssessment, run_batch, validate_harness, validate_raw
from grader.llm import cost_usd
from grader.schemas import RawAssessment, Usage
from grader.setup import grader_instructions, validate_rubric

from .conftest import FakeLLM, exercise, harness, rubric, run, submission


def test_valid_proposal_total_is_server_computed():
    assert validate_harness(harness((3, 2)), rubric()) == 5


def test_zero_is_a_valid_score():
    assert validate_harness(harness((0, 0)), rubric()) == 0


@pytest.mark.parametrize("points", [(4, 2), (-1, 2), (3, None)])
def test_out_of_range_or_missing_points_rejected(points):
    with pytest.raises(InvalidAssessment):
        validate_harness(harness(points), rubric())


def test_unknown_or_missing_criterion_rejected():
    a = harness()
    a.criteria[1].criterion_id = "C9"
    with pytest.raises(InvalidAssessment, match="do not match"):
        validate_harness(a, rubric())
    a.criteria = a.criteria[:1]
    with pytest.raises(InvalidAssessment):
        validate_harness(a, rubric())


def test_review_required_has_no_total_and_no_scores():
    ok = harness((None, None), status="review_required", reasons=["page 2 missing"])
    assert validate_harness(ok, rubric()) is None
    with pytest.raises(InvalidAssessment, match="must not carry"):
        validate_harness(harness((3, None), "review_required", ["x"]), rubric())
    with pytest.raises(InvalidAssessment, match="no review reason"):
        validate_harness(harness((None, None), "review_required"), rubric())


def test_missing_evidence_rejected():
    a = harness()
    a.criteria[0].evidence = "  "
    with pytest.raises(InvalidAssessment, match="evidence"):
        validate_harness(a, rubric())


def test_raw_baseline_range():
    assert validate_raw(RawAssessment(status="proposed", score=7, comment=""), 7) == 7
    assert validate_raw(RawAssessment(status="review_required", score=None, comment=""), 7) is None
    with pytest.raises(InvalidAssessment):
        validate_raw(RawAssessment(status="proposed", score=8, comment=""), 7)


def test_rubric_validation():
    r = rubric()
    assert validate_rubric(r) == []
    r.criteria[1].id = "C1"
    r.criteria[0].max_points = 0
    errors = validate_rubric(r)
    assert any("duplicate" in e for e in errors) and any("max_points" in e for e in errors)


def test_cost_uses_cached_price_and_is_none_when_unknown():
    u = Usage(input_tokens=1_000_000, cached_tokens=500_000, output_tokens=1_000_000)
    prices = {"m": {"input_per_1m": 2.0, "cached_input_per_1m": 0.5, "output_per_1m": 8.0}}
    assert cost_usd("m", u, prices) == pytest.approx(1.0 + 0.25 + 8.0)
    assert cost_usd("other", u, prices) is None


def batch(fake, runs, subs):
    ex = exercise()
    pages = {s.id: [Path(f"/originals/{s.id}/{p}") for p in s.pages] for s in subs}
    skill = grader_instructions(ex)
    return asyncio.run(run_batch(runs, ex, {s.id: s for s in subs}, pages, skill, fake, 4))


def test_parallel_multi_model_batch_and_anonymised_text():
    fake = FakeLLM(delay=0.05)
    subs = [submission("sub1", "S0"), submission("sub2", "S1")]
    runs = [run(f"r{i}", s.id, m, mode) for i, (s, m, mode) in enumerate(
        (s, m, mode) for s in subs for m in ("m-small", "m-big") for mode in ("harness", "raw"))]
    out = batch(fake, runs, subs)
    assert len(out) == 8 and fake.max_active > 1, "runs must execute concurrently"
    h = next(r for r in out if r.mode == "harness")
    assert h.status == "proposed" and h.total == 5 and h.usage.cached_tokens == 20
    assert h.finished_at and h.duration_s is not None
    assert fake.calls[0]["images"] == [Path("/originals/sub1/p1.png")]
    # the student label never reaches the model
    assert all("S0" not in c["text"] and "S1" not in c["text"] for c in fake.calls)


def test_concurrency_limit_is_respected():
    fake = FakeLLM(delay=0.02)
    subs = [submission(f"sub{i}") for i in range(6)]
    ex = exercise()
    asyncio.run(run_batch([run(f"r{i}", s.id) for i, s in enumerate(subs)], ex,
                          {s.id: s for s in subs}, {s.id: [] for s in subs},
                          grader_instructions(ex), fake, 2))
    assert fake.max_active == 2


def test_provider_failure_gives_failed_run_without_score():
    out = {r.model: r for r in batch(FakeLLM(fail_models={"m-big"}),
                                     [run("a", model="m-small"), run("b", model="m-big")],
                                     [submission()])}
    assert out["m-big"].status == "failed" and out["m-big"].total is None
    assert "provider down" in out["m-big"].error
    assert out["m-small"].status == "proposed"


def test_malformed_output_fails_but_keeps_usage():
    (r,) = batch(FakeLLM(harness_out=harness((9, 2))), [run("a")], [submission()])  # C1 max is 3
    assert r.status == "failed" and r.total is None and r.usage.total_tokens == 150


def test_language_reaches_prompt_but_not_cached_instructions():
    fake = FakeLLM()
    batch(fake, [run("a", language="es"), run("b", mode="raw", language="es")], [submission()])
    assert all("in Spanish" in c["text"] for c in fake.calls)
    assert "Spanish" not in fake.calls[0]["instructions"]
