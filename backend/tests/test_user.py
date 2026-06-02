def _auth_header(client, email="u@example.com", password="pass123"):
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    res = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    token = res.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_get_me(client):
    headers = _auth_header(client)
    res = client.get("/api/v1/users/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["data"]["email"] == "u@example.com"


def test_update_me(client):
    headers = _auth_header(client, "upd@example.com", "pass")
    res = client.patch("/api/v1/users/me", json={"full_name": "Updated"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["data"]["full_name"] == "Updated"


def test_get_me_unauthenticated(client):
    res = client.get("/api/v1/users/me")
    assert res.status_code == 401
