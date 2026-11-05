"""PL-12–14: AC-P07, and invalid uploads."""

import hashlib
from pathlib import Path

from conftest import JPG, PNG, ready_problem, teacher
from sqlalchemy import create_engine, text


def test_scan_and_raw_capture_are_both_kept(admin, clean_db):  # AC-P07
    p = ready_problem(admin)
    r = admin.post(f"/api/problems/{p['id']}/answers", data={"capture_of": ["0"]},
                   files=[("pages", ("scan.png", PNG, "image/png")),
                          ("captures", ("raw.jpg", JPG, "image/jpeg"))])
    assert r.status_code == 201
    page = admin.get(f"/api/answers/{r.json()['id']}").json()["pages"][0]
    assert page["kind"] == "scan" and page["derived_from"]
    assert admin.get(f"/api/files/{page['id']}").content == PNG
    assert admin.get(f"/api/files/{page['derived_from']}").content == JPG
    with create_engine(clean_db).connect() as c:
        path, sha = c.execute(text("SELECT path, sha256 FROM files WHERE kind = 'capture'")).one()
    assert Path(path).read_bytes() == JPG and sha == hashlib.sha256(JPG).hexdigest()


def test_invalid_uploads_store_nothing(admin, clean_db):
    p = ready_problem(admin)
    url = f"/api/problems/{p['id']}/answers"
    pdf = [("pages", ("a.pdf", b"%PDF", "application/pdf"))]
    assert admin.post(url, files=pdf).status_code == 422
    assert admin.post(url, files=[("pages", ("a.png", b"", "image/png"))]).status_code == 422
    assert admin.post(url, data={"capture_of": ["3"]},
                      files=[("pages", ("a.png", PNG, "image/png")),
                             ("captures", ("r.jpg", JPG, "image/jpeg"))]).status_code == 422
    with create_engine(clean_db).connect() as c:
        assert c.execute(text("SELECT count(*) FROM files")).scalar() == 0
        assert c.execute(text("SELECT count(*) FROM answers")).scalar() == 0


def test_files_are_private(admin, make_client):
    p = ready_problem(admin)
    r = admin.post(f"/api/problems/{p['id']}/answers",
                   files=[("pages", ("a.png", PNG, "image/png"))]).json()
    fid = admin.get(f"/api/answers/{r['id']}").json()["pages"][0]["id"]
    other = teacher(make_client, admin, "tess@example.test")
    assert other.get(f"/api/files/{fid}").status_code == 404
    assert other.get(f"/api/answers/{r['id']}").status_code == 404
