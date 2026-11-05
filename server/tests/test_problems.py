"""PL-15–19: AC-P04, AC-P05, AC-P06."""

from conftest import PNG, ready_problem, teacher, upload

from grader.llm import LLMError


def test_title_only_draft_is_listed(admin):  # AC-P04
    r = admin.post("/api/problems", json={"title": "  Inclined plane  "})
    assert r.status_code == 201 and r.json()["status"] == "draft"
    assert [p["title"] for p in admin.get("/api/problems").json()] == ["Inclined plane"]
    assert admin.post("/api/problems", json={"title": ""}).status_code == 422


def test_generate_needs_statement_and_solution(admin):
    p = admin.post("/api/problems", json={"title": "P1"}).json()
    assert admin.post(f"/api/problems/{p['id']}/generate").status_code == 422
    # an image of the statement counts as a statement
    admin.post(f"/api/problems/{p['id']}/files", data={"role": "statement"},
               files=[("pages", ("s.png", PNG, "image/png"))])
    admin.patch(f"/api/problems/{p['id']}", json={"solution_text": "a = 2 m/s²"})
    r = admin.post(f"/api/problems/{p['id']}/generate")
    assert r.status_code == 202 and r.json()["preparing"] is True  # PL-43: a background job
    r = admin.get(f"/api/problems/{p['id']}").json()  # the test client runs it before returning
    assert r["proposal"]["rubric"]["criteria"][0]["id"] == "C1"
    assert not r["preparing"] and r["prepare_error"] is None
    assert admin.get("/api/problems/preparing").json() == []


def prepared_text(c, title="P"):
    p = c.post("/api/problems", json={"title": title}).json()
    c.patch(f"/api/problems/{p['id']}", json={"statement_text": "s", "solution_text": "a"})
    return p


def test_preparing_is_shared_and_runs_once(admin, make_client):  # AC-P20
    from primgrade_server import db, grading, models

    p = prepared_text(admin)
    with db.session() as s:  # as if a job were still running (another tab started it)
        s.get(models.Problem, p["id"]).preparing_since = models.now()
        s.commit()
    assert admin.get("/api/problems/preparing").json() == [p["id"]]
    assert admin.get("/api/problems").json()[0]["preparing"] is True
    r = admin.post(f"/api/problems/{p['id']}/generate")
    assert r.status_code == 409
    other = teacher(make_client, admin, "bo@example.test")
    assert other.get("/api/problems/preparing").json() == []
    grading.fail_interrupted()  # a restart: no job is running any more
    r = admin.get(f"/api/problems/{p['id']}").json()
    assert not r["preparing"] and "restart" in r["prepare_error"] and r["proposal"] is None


def test_provider_failure_while_preparing_stores_no_proposal(admin, monkeypatch):  # AC-P20, I2
    from primgrade_server import ai

    async def broken(*args):
        raise LLMError("provider down")

    monkeypatch.setattr(ai, "llm_for", lambda settings, user: broken)
    p = prepared_text(admin)
    assert admin.post(f"/api/problems/{p['id']}/generate").status_code == 202
    r = admin.get(f"/api/problems/{p['id']}").json()
    assert r["proposal"] is None and not r["preparing"] and "provider down" in r["prepare_error"]


def test_editing_a_ready_rubric_makes_a_new_version(admin):  # AC-P05
    p = ready_problem(admin)
    assert p["status"] == "ready" and p["rubric_version"] == 1
    a = upload(admin, p["id"], label="A1")
    admin.post("/api/answers/grade", json={"answer_ids": [a["id"]]})
    proposal = p["proposal"]
    proposal["rubric"]["criteria"][1]["max_points"] = 5
    r = admin.put(f"/api/problems/{p['id']}/proposal", json={"proposal": proposal})
    assert r.json()["status"] == "draft"
    r = admin.post(f"/api/problems/{p['id']}/accept", json={})
    assert r.json()["rubric_version"] == 2
    old = admin.get(f"/api/answers/{a['id']}").json()
    assert old["rubric_version"] == 1 and old["runs"][0]["max_points"] == 7
    assert old["rubric"]["criteria"][1]["max_points"] == 4


def test_invalid_rubric_and_unacknowledged_issues_block_accept(admin):
    p = ready_problem(admin)
    bad = p["proposal"]
    bad["rubric"]["criteria"][1]["id"] = "C1"  # duplicate id
    admin.put(f"/api/problems/{p['id']}/proposal", json={"proposal": bad})
    assert admin.post(f"/api/problems/{p['id']}/accept", json={}).status_code == 422
    bad["rubric"]["criteria"][1]["id"] = "C2"
    bad["issues"] = ["The solution uses g = 9.8 but the statement says 10"]
    admin.put(f"/api/problems/{p['id']}/proposal", json={"proposal": bad})
    assert admin.post(f"/api/problems/{p['id']}/accept", json={}).status_code == 409
    r = admin.post(f"/api/problems/{p['id']}/accept", json={"issues_acknowledged": True})
    assert r.status_code == 200 and r.json()["rubric_version"] == 2


def test_improve_then_discard_keeps_the_proposal(admin):  # AC-P06
    p = ready_problem(admin)
    r = admin.post(f"/api/problems/{p['id']}/improve",
                   json={"instruction": "Accept g = 9.8 as well"}).json()
    assert r["pending_instruction"] == "Accept g = 9.8 as well"
    assert r["pending_proposal"]["assumptions"] != r["proposal"]["assumptions"]
    r = admin.post(f"/api/problems/{p['id']}/improve/discard").json()
    assert r["proposal"] == p["proposal"] and r["pending_proposal"] is None
    assert r["status"] == "ready"
    admin.post(f"/api/problems/{p['id']}/improve", json={"instruction": "x"})
    r = admin.post(f"/api/problems/{p['id']}/improve/keep").json()
    assert r["status"] == "draft" and r["proposal"] != p["proposal"]
    assert admin.post(f"/api/problems/{p['id']}/improve/keep").status_code == 409


def test_problems_are_private_and_used_ones_are_not_deleted(admin, make_client):
    p = ready_problem(admin)
    other = teacher(make_client, admin, "tess@example.test")
    assert other.get(f"/api/problems/{p['id']}").status_code == 404
    assert other.get("/api/problems").json() == []
    upload(admin, p["id"])
    assert admin.delete(f"/api/problems/{p['id']}").status_code == 409
    q = admin.post("/api/problems", json={"title": "spare"}).json()
    assert admin.delete(f"/api/problems/{q['id']}").status_code == 204


def test_tags_are_kept_per_teacher_and_suggested(admin, make_client):  # AC-P19
    p = admin.post("/api/problems", json={"title": "P1"}).json()
    assert p["tags"] == []
    tags = [" Mechanics ", "mechanics", "Exam 1"]
    r = admin.patch(f"/api/problems/{p['id']}", json={"tags": tags})
    assert r.json()["tags"] == ["Mechanics", "Exam 1"] and r.json()["status"] == "draft"
    q = admin.post("/api/problems", json={"title": "P2"}).json()
    admin.patch(f"/api/problems/{q['id']}", json={"tags": ["Optics", "exam 1"]})
    assert admin.get("/api/problems/tags").json() == ["Exam 1", "Mechanics", "Optics"]
    # a tag the teacher already has keeps its first spelling
    assert admin.get("/api/problems").json()[0]["tags"] == ["Optics", "Exam 1"]
    # removed from every problem, a tag still exists
    admin.patch(f"/api/problems/{q['id']}", json={"tags": []})
    assert admin.get("/api/problems/tags").json() == ["Exam 1", "Mechanics", "Optics"]
    assert admin.patch(f"/api/problems/{p['id']}", json={"tags": [""]}).status_code == 422
    assert admin.patch(f"/api/problems/{p['id']}", json={"tags": ["x" * 41]}).status_code == 422
    other = teacher(make_client, admin, "other@example.test")
    assert other.get("/api/problems/tags").json() == []  # a teacher never sees another's tags
