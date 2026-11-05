"""PL-20–24: AC-P08, AC-P09."""

import pytest
from conftest import ready_problem, upload
from primgrade_server import ai

from grader.llm import LLMError


def graded(c, problem_id: str) -> dict:
    a = upload(c, problem_id, label="A1")
    assert c.post("/api/answers/grade", json={"answer_ids": [a["id"]]}).status_code == 202
    return c.get(f"/api/answers/{a['id']}").json()


def test_grading_proposes_a_draft_with_evidence(admin):
    p = ready_problem(admin)
    a = graded(admin, p["id"])
    run = a["runs"][0]
    assert a["state"] == "proposed" and a["approval"] is None  # I1: still a draft
    assert run["total"] == 5 and run["max_points"] == 7
    c1 = run["harness"]["criteria"][0]
    assert c1["source"] and c1["evidence"] and c1["reasoning"] and c1["confidence"]  # I3


@pytest.mark.parametrize("error", [LLMError("provider down"), ValueError("malformed output")])
def test_provider_failure_shows_failed_and_no_score(admin, monkeypatch, error):  # AC-P08
    p = ready_problem(admin)

    async def broken(*args):
        raise error

    monkeypatch.setattr(ai, "llm_for", lambda settings, user: broken)
    a = graded(admin, p["id"])
    assert a["state"] in ("failed", "review_required")
    assert a["runs"][0]["total"] is None and a["proposed_total"] is None


def test_grading_a_draft_problem_is_refused(admin):
    p = admin.post("/api/problems", json={"title": "draft"}).json()
    a = upload(admin, p["id"])
    assert admin.post("/api/answers/grade", json={"answer_ids": [a["id"]]}).status_code == 409


def test_approve_with_edits_keeps_the_proposal_and_the_verdict(admin):  # AC-P09
    p = ready_problem(admin)
    a = graded(admin, p["id"])
    run = a["runs"][0]
    url = f"/api/answers/{a['id']}/approve"
    scores = [{"criterion_id": "C1", "points": 3}, {"criterion_id": "C2", "points": 4}]
    base = {"run_id": run["id"], "scores": scores, "feedback": "Good."}
    assert admin.post(url, json=base).status_code == 422  # verdict required
    assert admin.post(url, json={**base, "ai_verdict": "wrong"}).status_code == 422  # no reason
    r = admin.post(url, json={**base, "ai_verdict": "wrong", "wrong_criteria": ["C2"],
                              "wrong_reason": "misread_handwriting"})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["state"] == "approved" and out["approved_total"] == 7
    assert out["approval"]["edited_criteria"] == ["C2"]
    assert out["approval"]["ai_verdict"] == "wrong"
    assert out["approval"]["wrong_reason"] == "misread_handwriting"
    assert out["runs"][0]["total"] == 5  # the AI proposal is untouched
    assert out["runs"][0]["harness"]["criteria"][1]["points"] == 2


def test_scores_must_match_the_rubric(admin):
    p = ready_problem(admin)
    a = graded(admin, p["id"])
    url = f"/api/answers/{a['id']}/approve"
    base = {"run_id": a["runs"][0]["id"], "feedback": "", "ai_verdict": "correct"}
    assert admin.post(url, json={**base, "scores": [{"criterion_id": "C1", "points": 3}]}
                      ).status_code == 422
    assert admin.post(url, json={**base, "scores": [{"criterion_id": "C1", "points": 3},
                                                    {"criterion_id": "C2", "points": 9}]}
                      ).status_code == 422
    ok = admin.post(url, json={**base, "scores": [{"criterion_id": "C1", "points": 1.5},
                                                  {"criterion_id": "C2", "points": 2}]})
    assert ok.json()["approved_total"] == 3.5  # partial credit


def test_teacher_can_grade_without_ai(admin):
    p = ready_problem(admin)
    a = upload(admin, p["id"])
    r = admin.post(f"/api/answers/{a['id']}/approve",
                   json={"scores": [{"criterion_id": "C1", "points": 0},
                                    {"criterion_id": "C2", "points": 0}], "feedback": "blank"})
    assert r.status_code == 200 and r.json()["approval"]["ai_verdict"] is None


def test_ai_output_uses_the_teachers_language(admin, monkeypatch):  # PL-37, AC-P17
    real, prompts = ai.llm_for, []

    def spy(settings, user):
        llm = real(settings, user)

        async def call(model, instructions, text, *rest):
            prompts.append(text)
            return await llm(model, instructions, text, *rest)
        return call

    monkeypatch.setattr(ai, "llm_for", spy)
    assert admin.put("/api/settings", json={"language": "es"}).status_code == 200
    p = ready_problem(admin)
    assert p["language"] == "es"
    run = graded(admin, p["id"])["runs"][0]
    assert run["language"] == "es"
    assert len(prompts) == 2 and all("Spanish" in t for t in prompts)  # setup and grading


def test_problem_answers_are_listed_newest_first(admin):  # PL-45, AC-P22
    p = ready_problem(admin)
    for label in ("A1", "A2", "A3"):
        upload(admin, p["id"], label=label)
    rows = admin.get(f"/api/problems/{p['id']}/answers").json()
    assert [r["label"] for r in rows] == ["A3", "A2", "A1"]


def test_an_answer_can_name_one_of_the_teachers_groups(admin, make_client):  # PL-46, AC-P23
    from conftest import PNG, teacher

    p = ready_problem(admin)
    g = admin.post("/api/groups", json={"name": "Group A"}).json()
    r = admin.post(f"/api/problems/{p['id']}/answers",
                   data={"student_name": "Ann", "group_id": g["id"]},
                   files=[("pages", ("a.png", PNG, "image/png"))])
    assert r.status_code == 201 and r.json()["group_id"] == g["id"] and r.json()["exam_id"] is None
    plain = upload(admin, p["id"], label="no group")
    assert plain["group_id"] is None
    other = teacher(make_client, admin, "bo@example.test")
    theirs = other.post("/api/groups", json={"name": "Theirs"}).json()
    r = admin.post(f"/api/problems/{p['id']}/answers", data={"group_id": theirs["id"]},
                   files=[("pages", ("a.png", PNG, "image/png"))])
    assert r.status_code == 404
    e = admin.post("/api/exams", json={"title": "Midterm"}).json()
    r = admin.post(f"/api/problems/{p['id']}/answers", data={"exam_id": e["id"]},
                   files=[("pages", ("a.png", PNG, "image/png"))])
    assert r.status_code == 422  # an exam still needs its group
