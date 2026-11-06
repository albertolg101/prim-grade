"""PL-25–27: AC-P10, groups and exam answers."""

from conftest import ready_problem


def test_problem_created_inside_an_exam_is_added(admin):  # AC-P10
    e = admin.post("/api/exams", json={"title": "Midterm"}).json()
    r = admin.post(f"/api/exams/{e['id']}/problems/new", json={"title": "Q1"})
    assert r.status_code == 201
    out = r.json()
    assert [p["id"] for p in out["problems"]] == [out["created_problem_id"]]
    assert [p["title"] for p in admin.get("/api/problems").json()] == ["Q1"]


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
    assert r.json()["groups"] == [{"id": g["id"], "name": "Group A"}]
    a = admin.post(f"/api/problems/{p1['id']}/answers",
                   data={"student_name": "Student One", "exam_id": e["id"], "group_id": g["id"]},
                   files=[("pages", ("a.png", b"\x89PNG..", "image/png"))])
    assert a.status_code == 201
    rows = admin.get(f"/api/exams/{e['id']}/groups/{g['id']}/answers").json()["answers"]
    assert [x["student_name"] for x in rows] == ["Student One"]
    assert admin.get("/api/groups").json()[0]["students"] == ["Student One"]
    # a group or problem with answers cannot be taken out of the exam
    assert admin.put(f"/api/exams/{e['id']}/groups", json={"group_ids": []}).status_code == 409
    assert admin.delete(f"/api/exams/{e['id']}/problems/{p1['id']}").status_code == 409
    assert admin.delete(f"/api/exams/{e['id']}/problems/{p2['id']}").is_success


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
