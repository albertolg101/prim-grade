"""PL-28–31, PL-35: AC-P11, AC-P12, AC-P15, AC-P16."""

import asyncio
from datetime import UTC, datetime, timedelta

from conftest import PNG, ready_problem
from fastapi.testclient import TestClient
from primgrade_server.routes.public import CONFLICT
from sqlalchemy import create_engine, text


def setup_exam(admin):
    e = admin.post("/api/exams", json={"title": "Quiz 2"}).json()
    g = admin.post("/api/groups", json={"name": "Group B"}).json()
    p1, p2 = ready_problem(admin, "Q1"), ready_problem(admin, "Q2")
    for p in (p1, p2):
        admin.post(f"/api/exams/{e['id']}/problems", json={"problem_id": p["id"]})
    admin.put(f"/api/exams/{e['id']}/groups", json={"group_ids": [g["id"]]})
    return e, g, p1, p2


def open_link(admin, e, g, minutes=None):
    r = admin.post(f"/api/exams/{e['id']}/groups/{g['id']}/links", json={"minutes": minutes})
    assert r.status_code == 201, r.text
    link = r.json()
    return link, link["url"].rsplit("/", 1)[1]


def student(admin) -> TestClient:
    return TestClient(admin.app)


def submit(c, token, name, problem_id):
    return c.post(f"/api/public/links/{token}/answers",
                  data={"student_name": name, "problem_id": problem_id},
                  files=[("pages", ("p.png", PNG, "image/png"))])


def count(url, table):
    with create_engine(url).connect() as c:
        return c.execute(text(f"SELECT count(*) FROM {table}")).scalar()


def test_link_lifetime_and_close(admin, clean_db):  # AC-P11
    e, g, p1, _ = setup_exam(admin)
    admin.put("/api/settings", json={"link_minutes": 1})
    link, token = open_link(admin, e, g)
    assert link["state"] == "open" and link["url"].startswith("https://grade.example.test/s/")
    s = student(admin)
    assert s.get(f"/api/public/links/{token}").json()["open"] is True
    with create_engine(clean_db).begin() as c:  # one minute later
        c.execute(text("UPDATE upload_links SET expires_at = :t"),
                  {"t": datetime.now(UTC) - timedelta(seconds=1)})
    assert submit(s, token, "Student One", p1["id"]).status_code == 410
    link2, token2 = open_link(admin, e, g, minutes=30)
    assert admin.post(f"/api/links/{link2['id']}/close").json()["state"] == "closed"
    assert submit(s, token2, "Student One", p1["id"]).status_code == 410
    assert count(clean_db, "answers") == 0 and count(clean_db, "files") == 0


def test_repeat_uploads_are_versions_and_other_problems_allowed(admin):  # AC-P12, AC-P16
    e, g, p1, p2 = setup_exam(admin)
    _, token = open_link(admin, e, g)
    s = student(admin)
    s.get(f"/api/public/links/{token}")
    assert submit(s, token, "Student One", p1["id"]).json()["version"] == 1
    assert submit(s, token, " student  one ", p1["id"]).json()["version"] == 2
    assert submit(s, token, "Student One", p2["id"]).json()["version"] == 1
    rows = admin.get(f"/api/exams/{e['id']}/groups/{g['id']}/answers").json()["answers"]
    q1 = [r for r in rows if r["problem_id"] == p1["id"]]
    assert [(r["version"], r["selected"], r["source"]) for r in q1] == [
        (1, False, "student"), (2, True, "student")]
    admin.post(f"/api/answers/{q1[0]['id']}/select")
    detail = admin.get(f"/api/answers/{q1[0]['id']}").json()
    assert [v["selected"] for v in detail["versions"]] == [True, False]
    assert detail["state"] == "not_graded"  # student uploads are not graded by themselves


def test_shared_browser_cannot_submit_for_another_student(admin, clean_db):  # AC-P15
    e, g, p1, _ = setup_exam(admin)
    _, token = open_link(admin, e, g)
    s = student(admin)
    s.get(f"/api/public/links/{token}")
    cookie = s.cookies.get("pg_student")
    assert cookie and len(cookie) >= 32
    assert submit(s, token, "Student One", p1["id"]).status_code == 201
    files_before = count(clean_db, "files")
    r = submit(s, token, "Student Two", p1["id"])
    assert r.status_code == 409 and r.json()["detail"] == CONFLICT
    assert "One" not in r.text
    _, token2 = open_link(admin, e, g)  # a replacement link for the same exam and group
    assert submit(s, token2, "Student Two", p1["id"]).status_code == 409
    assert count(clean_db, "files") == files_before and count(clean_db, "answers") == 1
    assert count(clean_db, "runs") == 0
    # the teacher uploads on Student Two's behalf
    r = admin.post(f"/api/problems/{p1['id']}/answers",
                   data={"student_name": "Student Two", "exam_id": e["id"], "group_id": g["id"]},
                   files=[("pages", ("p.png", PNG, "image/png"))])
    assert r.status_code == 201 and r.json()["source"] == "teacher"


def test_no_cookie_is_refused(admin, clean_db):
    e, g, p1, _ = setup_exam(admin)
    _, token = open_link(admin, e, g)
    r = submit(student(admin), token, "Student One", p1["id"])  # never opened the page
    assert r.status_code == 400 and count(clean_db, "answers") == 0


def test_concurrent_first_submissions_bind_one_name(admin, clean_db):  # AC-P15
    import httpx

    e, g, p1, _ = setup_exam(admin)
    _, token = open_link(admin, e, g)
    s = student(admin)
    s.get(f"/api/public/links/{token}")
    cookie = s.cookies.get("pg_student")

    async def race():
        transport = httpx.ASGITransport(app=admin.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver",
                                     cookies={"pg_student": cookie}) as c:
            async def one(name):
                return await c.post(f"/api/public/links/{token}/answers",
                                    data={"student_name": name, "problem_id": p1["id"]},
                                    files=[("pages", ("p.png", PNG, "image/png"))])
            return await asyncio.gather(*(one(f"Student {i}") for i in range(6)))

    codes = sorted(r.status_code for r in asyncio.run(race()))
    assert codes == [201, 409, 409, 409, 409, 409]
    assert count(clean_db, "student_bindings") == 1 and count(clean_db, "answers") == 1


def test_link_needs_a_problem_and_unknown_link_404(admin):
    e = admin.post("/api/exams", json={"title": "Empty"}).json()
    g = admin.post("/api/groups", json={"name": "G"}).json()
    admin.put(f"/api/exams/{e['id']}/groups", json={"group_ids": [g["id"]]})
    assert admin.post(f"/api/exams/{e['id']}/groups/{g['id']}/links",
                      json={}).status_code == 409
    assert student(admin).get("/api/public/links/nope").status_code == 404
