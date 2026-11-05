"""PL-32–34: AC-P13."""

import pytest
from conftest import PNG, ready_problem


def test_totals_add_up(admin):  # AC-P13
    e = admin.post("/api/exams", json={"title": "Final"}).json()
    g = admin.post("/api/groups", json={"name": "Group A"}).json()
    p = ready_problem(admin)  # one setup call
    admin.post(f"/api/exams/{e['id']}/problems", json={"problem_id": p["id"]})
    admin.put(f"/api/exams/{e['id']}/groups", json={"group_ids": [g["id"]]})
    ids = [admin.post(f"/api/problems/{p['id']}/answers",
                      data={"student_name": n, "exam_id": e["id"], "group_id": g["id"]},
                      files=[("pages", ("a.png", PNG, "image/png"))]).json()["id"]
           for n in ("Student One", "Student Two")]
    admin.post("/api/answers/grade", json={"answer_ids": ids})  # two grading calls
    c = admin.get("/api/costs").json()
    [row] = c["problems"]
    assert row["setup_usd"] > 0 and row["grading_usd"] == pytest.approx(2 * row["setup_usd"])
    assert c["total_usd"] == pytest.approx(row["setup_usd"] + row["grading_usd"])
    for key in ("groups", "exams", "exam_groups"):
        [r] = c[key]
        assert r["usd"] == pytest.approx(row["grading_usd"]) and r["calls"] == 2
    usage = admin.get("/api/admin/usage").json()
    assert sum(u["usd"] for u in usage) == pytest.approx(c["total_usd"])
