"""PL-06–08, PL-37: AC-P03, AC-P17."""

from sqlalchemy import create_engine, text

KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz0123456789WXYZ"


def test_key_is_never_returned_and_is_encrypted(admin, clean_db):  # AC-P03
    r = admin.put("/api/settings/api-key", json={"api_key": KEY})
    assert r.json() == {"theme": "system", "language": "en", "link_minutes": 10,
                        "export_format": "xlsx", "has_api_key": True, "api_key_last4": "WXYZ"}
    assert KEY not in admin.get("/api/settings").text
    assert KEY not in admin.get("/api/admin/users").text
    with create_engine(clean_db).connect() as c:
        stored = c.execute(text("SELECT api_key_enc FROM users")).scalar()
    assert stored and KEY not in stored
    assert admin.delete("/api/settings/api-key").json()["has_api_key"] is False


def test_ai_is_refused_without_a_key(make_client):  # AC-P03
    from conftest import login, signup

    c = make_client(llm="openai")
    signup(c, "ada@example.test")
    login(c, "ada@example.test")
    p = c.post("/api/problems", json={"title": "P1"}).json()
    c.patch(f"/api/problems/{p['id']}", json={"statement_text": "s", "solution_text": "a"})
    r = c.post(f"/api/problems/{p['id']}/generate")
    assert r.status_code == 409 and "Settings" in r.json()["detail"]


def test_theme_and_link_minutes(admin):
    r = admin.put("/api/settings", json={"theme": "dark", "link_minutes": 25})
    assert r.json()["theme"] == "dark" and r.json()["link_minutes"] == 25
    assert admin.put("/api/settings", json={"theme": "blue", "link_minutes": 5}).status_code == 422
    assert admin.put("/api/settings", json={"theme": "light", "link_minutes": 0}).status_code == 422


def test_settings_change_only_the_fields_sent(admin):  # PL-07, PL-37
    admin.put("/api/settings", json={"theme": "dark", "link_minutes": 25})
    r = admin.put("/api/settings", json={"language": "ru"})
    assert (r.json()["theme"], r.json()["language"], r.json()["link_minutes"]) == ("dark", "ru", 25)
    assert admin.get("/api/auth/me").json()["language"] == "ru"
    assert admin.put("/api/settings", json={"language": "fr"}).status_code == 422
