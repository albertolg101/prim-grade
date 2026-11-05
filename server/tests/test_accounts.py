"""PL-01–05: AC-P01, AC-P02."""

from conftest import login, signup


def test_first_signup_is_admin_and_others_wait_for_approval(client):  # AC-P01
    first = signup(client, "ada@example.test", "Ada").json()
    assert first["is_admin"] and first["status"] == "approved"
    second = signup(client, "bob@example.test", "Bob")
    assert second.status_code == 201 and second.json()["status"] == "pending"
    r = login(client, "bob@example.test")
    assert r.status_code == 403 and "approval" in r.json()["detail"]
    assert login(client, "ada@example.test").status_code == 200
    client.post(f"/api/admin/users/{second.json()['id']}/status", json={"status": "approved"})
    assert login(client, "bob@example.test").status_code == 200


def test_duplicate_email_wrong_password_and_rejected(client):
    signup(client, "ada@example.test")
    assert signup(client, "ADA@example.test").status_code == 409
    assert login(client, "ada@example.test", "wrong password").status_code == 401
    bob = signup(client, "bob@example.test").json()
    login(client, "ada@example.test")
    client.post(f"/api/admin/users/{bob['id']}/status", json={"status": "rejected"})
    assert login(client, "bob@example.test").status_code == 403


def test_last_admin_keeps_rights_and_granted_admin_can_approve(admin, make_client):  # AC-P02
    me = admin.get("/api/auth/me").json()
    r = admin.post(f"/api/admin/users/{me['id']}/admin", json={"is_admin": False})
    assert r.status_code == 409
    assert admin.post(f"/api/admin/users/{me['id']}/status",
                      json={"status": "deactivated"}).status_code == 409
    other = make_client()
    bob = signup(other, "bob@example.test", "Bob").json()
    admin.post(f"/api/admin/users/{bob['id']}/status", json={"status": "approved"})
    assert admin.post(f"/api/admin/users/{bob['id']}/admin", json={"is_admin": True}).is_success
    login(other, "bob@example.test")
    carl = signup(make_client(), "carl@example.test").json()
    assert other.post(f"/api/admin/users/{carl['id']}/status",
                      json={"status": "approved"}).is_success
    # now that there are two admins, the first may step down
    assert admin.post(f"/api/admin/users/{me['id']}/admin", json={"is_admin": False}).is_success


def test_non_admin_cannot_use_admin_routes_and_logout_ends_session(admin, make_client):
    from conftest import teacher

    t = teacher(make_client, admin, "tess@example.test")
    assert t.get("/api/admin/users").status_code == 403
    assert t.post("/api/auth/logout").is_success
    assert t.get("/api/auth/me").status_code == 401


def test_deactivated_teacher_is_signed_out(admin, make_client):
    from conftest import teacher

    t = teacher(make_client, admin, "tess@example.test")
    uid = t.get("/api/auth/me").json()["id"]
    admin.post(f"/api/admin/users/{uid}/status", json={"status": "deactivated"})
    assert t.get("/api/auth/me").status_code == 401
