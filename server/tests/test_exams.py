"""PL-25–27, PL-55: groups and exam answers."""

from conftest import PNG, ready_problem, teacher
from fastapi.testclient import TestClient


def test_exam_problems_groups_and_order(admin):
    e = admin.post("/api/exams", json={"title": "Final"}).json()
    p1, p2 = ready_problem(admin, "Q1"), ready_problem(admin, "Q2")
    for p in (p1, p2):
        admin.post(f"/api/exams/{e['id']}/problems", json={"problem_id": p["id"]})
    assert admin.post(f"/api/exams/{e['id']}/problems",
                      json={"problem_id": p1["id"]}).status_code == 409
    r = admin.put(f"/api/exams/{e['id']}/problems", json={"problem_ids": [p2["id"], p1["id"]]})
    assert [p["title"] for p in r.json()["problems"]] == ["Q2", "Q1"]
    g = admin.post("/api/groups", json={"name": "Group A"}).json()
    r = admin.put(f"/api/exams/{e['id']}/groups", json={"group_ids": [g["id"]]})
    assert r.json()["groups"] == [{"id": g["id"], "name": "Group A", "students": 0,
                                   "per_problem": {}}]
    a = admin.post(f"/api/problems/{p1['id']}/answers",
                   data={"student_name": "Student One", "exam_id": e["id"], "group_id": g["id"]},
                   files=[("pages", ("a.png", b"\x89PNG..", "image/png"))])
    assert a.status_code == 201
    rows = admin.get(f"/api/exams/{e['id']}/groups/{g['id']}/answers").json()["answers"]
    assert [x["student_name"] for x in rows] == ["Student One"]
    assert admin.get("/api/groups").json()[0]["students"] == ["Student One"]
    # a group with answers cannot be taken out of the exam
    assert admin.put(f"/api/exams/{e['id']}/groups", json={"group_ids": []}).status_code == 409
    # PL-55: the group row counts the students, overall and per problem
    groups = admin.get(f"/api/exams/{e['id']}").json()["groups"]
    assert groups[0]["students"] == 1 and groups[0]["per_problem"] == {p1["id"]: 1}


def test_teacher_upload_needs_exam_and_group_together(admin):
    p = ready_problem(admin)
    e = admin.post("/api/exams", json={"title": "Final"}).json()
    r = admin.post(f"/api/problems/{p['id']}/answers", data={"exam_id": e["id"]},
                   files=[("pages", ("a.png", b"\x89PNG..", "image/png"))])
    assert r.status_code == 422


def test_groups_and_exams_say_when_they_were_created(admin):  # PL-49
    a = admin.post("/api/groups", json={"name": "B first"}).json()
    b = admin.post("/api/groups", json={"name": "A second"}).json()
    assert a["created_at"] <= b["created_at"]
    groups = {g["id"]: g["created_at"] for g in admin.get("/api/groups").json()}
    assert groups == {a["id"]: a["created_at"], b["id"]: b["created_at"]}
    admin.post("/api/exams", json={"title": "Older"})
    admin.post("/api/exams", json={"title": "Newer"})
    assert [e["title"] for e in admin.get("/api/exams").json()] == ["Newer", "Older"]


def test_an_exams_problem_is_switched_off_not_removed(admin):  # PL-55, AC-P29
    p1, p2 = ready_problem(admin, "Q1"), ready_problem(admin, "Q2")
    e = admin.post("/api/exams", json={"title": "Final",
                                       "problem_ids": [p1["id"], p2["id"]]}).json()
    g = admin.post("/api/groups", json={"name": "Group A"}).json()
    admin.put(f"/api/exams/{e['id']}/groups", json={"group_ids": [g["id"]]})
    assert admin.delete(f"/api/exams/{e['id']}/problems/{p1['id']}").status_code == 405
    assert admin.post(f"/api/exams/{e['id']}/problems/new", json={"title": "Q3"}).status_code == 405
    r = admin.patch(f"/api/exams/{e['id']}/problems/{p1['id']}", json={"active": False})
    shown = [(p["title"], p["active"]) for p in r.json()["problems"]]
    assert shown == [("Q1", False), ("Q2", True)]
    link = admin.post(f"/api/exams/{e['id']}/groups/{g['id']}/links", json={}).json()
    token = link["url"].rsplit("/", 1)[1]
    s = TestClient(admin.app)
    assert [p["title"] for p in s.get(f"/api/public/links/{token}").json()["problems"]] == ["Q2"]
    r = s.post(f"/api/public/links/{token}/answers",
               data={"student_name": "A", "problem_id": p1["id"]},
               files=[("pages", ("p.png", PNG, "image/png"))])
    assert r.status_code == 422
    admin.patch(f"/api/exams/{e['id']}/problems/{p2['id']}", json={"active": False})
    assert admin.post(f"/api/exams/{e['id']}/groups/{g['id']}/links", json={}).status_code == 409
    other = admin.post("/api/exams", json={"title": "Other"}).json()
    assert admin.patch(f"/api/exams/{other['id']}/problems/{p1['id']}",
                       json={"active": True}).status_code == 404


def test_exams_are_archived_and_opening_one_makes_it_recently_used(admin, make_client):  # AC-P30
    first = admin.post("/api/exams", json={"title": "First"}).json()
    second = admin.post("/api/exams", json={"title": "Second"}).json()
    assert first["archived"] is False and first["last_used_at"] == first["created_at"]
    assert admin.post(f"/api/exams/{first['id']}/opened").status_code == 204
    used = {x["title"]: x["last_used_at"] for x in admin.get("/api/exams").json()}
    assert used["First"] > used["Second"] == second["created_at"]
    r = admin.patch(f"/api/exams/{first['id']}", json={"archived": True})
    assert r.json()["archived"] is True and r.json()["title"] == "First"
    assert admin.patch(f"/api/exams/{first['id']}", json={"title": "Renamed"}).json()["archived"]
    theirs = teacher(make_client, admin, "other@example.test")
    assert theirs.post(f"/api/exams/{first['id']}/opened").status_code == 404
    assert theirs.patch(f"/api/exams/{first['id']}", json={"archived": False}).status_code == 404


def test_export_has_approved_marks_only(admin, make_client):  # PL-58, AC-P32
    p1, p2 = ready_problem(admin, "Q1"), ready_problem(admin, "Q2")
    e = admin.post("/api/exams", json={"title": "Final 1",
                                       "problem_ids": [p1["id"], p2["id"]]}).json()
    g = admin.post("/api/groups", json={"name": "Group A"}).json()
    admin.put(f"/api/exams/{e['id']}/groups", json={"group_ids": [g["id"]]})
    ids = {}
    for name, pid in [("Ana", p1["id"]), ("Ana", p2["id"]), ("=cmd", p1["id"])]:
        ids[name, pid] = admin.post(
            f"/api/problems/{pid}/answers",
            data={"student_name": name, "exam_id": e["id"], "group_id": g["id"]},
            files=[("pages", ("a.png", PNG, "image/png"))]).json()["id"]
    r = admin.post(f"/api/answers/{ids['Ana', p1['id']]}/approve",
                   json={"scores": [{"criterion_id": "C1", "points": 1.5},
                                    {"criterion_id": "C2", "points": 2}], "feedback": ""})
    assert r.status_code == 200
    r = admin.get(f"/api/exams/{e['id']}/export.csv")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    assert "Final_1-marks.csv" in r.headers["content-disposition"]
    # not approved stays empty (I1); a typed formula is not run by the spreadsheet
    assert r.text.splitlines() == ["Group,Student,Q1,Q2", "Group A,'=cmd,,", "Group A,Ana,3.5,"]
    other = teacher(make_client, admin, "other@example.test")
    assert other.get(f"/api/exams/{e['id']}/export.csv").status_code == 404
