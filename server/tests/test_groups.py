"""PL-51 group list and page, PL-52 an exam created with its problems in order."""

from conftest import ready_problem, teacher, upload


def test_group_page_lists_its_exams_and_problems_with_answers_to_grade(admin, make_client):
    g = admin.post("/api/groups", json={"name": "Mechanics A"}).json()
    in_exam, answered, elsewhere = (ready_problem(admin, t) for t in ("Q1", "Q2", "Q3"))
    e = admin.post("/api/exams", json={"title": "Midterm", "problem_ids": [in_exam["id"]]}).json()
    admin.put(f"/api/exams/{e['id']}/groups", json={"group_ids": [g["id"]]})
    a = upload(admin, answered["id"], student_name="Student One", group_id=g["id"])
    upload(admin, elsewhere["id"], student_name="Student Two")  # no group: not on the page

    out = admin.get(f"/api/groups/{g['id']}").json()
    assert [x["title"] for x in out["exams"]] == ["Midterm"]
    rows = {p["title"]: p for p in out["problems"]}
    assert set(rows) == {"Q1", "Q2"}
    assert (rows["Q1"]["answers"], rows["Q1"]["to_grade"]) == (0, [])
    q2 = rows["Q2"]
    assert (q2["answers"], q2["approved"], q2["to_grade"]) == (1, 0, [a["id"]])
    # used: created, then an answer uploaded; later than its creation
    listed = admin.get("/api/groups").json()[0]
    assert listed["last_used_at"] >= listed["created_at"]
    assert listed["last_used_at"] == out["last_used_at"]

    other = teacher(make_client, admin, "other@example.test")
    assert other.get(f"/api/groups/{g['id']}").status_code == 404


def test_an_exam_is_created_with_problems_in_the_given_order(admin, make_client):
    p1, p2, p3 = (admin.post("/api/problems", json={"title": t}).json() for t in ("A", "B", "C"))
    order = [p3["id"], p1["id"], p2["id"]]
    e = admin.post("/api/exams", json={"title": "Final", "problem_ids": order})
    assert e.status_code == 201
    assert [p["title"] for p in e.json()["problems"]] == ["C", "A", "B"]
    assert admin.post("/api/exams", json={"title": "Twice",
                                          "problem_ids": [p1["id"], p1["id"]]}).status_code == 422
    other = teacher(make_client, admin, "other@example.test")
    theirs = other.post("/api/exams", json={"title": "Theirs", "problem_ids": [p1["id"]]})
    assert theirs.status_code == 404
    assert [x["title"] for x in other.get("/api/exams").json()] == []  # nothing half-created
