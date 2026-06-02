def test_register(client):
    res = client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "password123",
        "full_name": "Test User",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert "access_token" in body["data"]
    assert "refresh_token" in body["data"]


def test_register_duplicate_email(client):
    payload = {"email": "dupe@example.com", "password": "password123"}
    client.post("/api/v1/auth/register", json=payload)
    res = client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 400


def test_login(client):
    client.post("/api/v1/auth/register", json={
        "email": "user@example.com",
        "password": "mypassword",
    })
    res = client.post("/api/v1/auth/login", data={
        "username": "user@example.com",
        "password": "mypassword",
    })
    assert res.status_code == 200
    assert res.json()["data"]["access_token"]


def test_login_wrong_password(client):
    client.post("/api/v1/auth/register", json={
        "email": "user2@example.com",
        "password": "correct",
    })
    res = client.post("/api/v1/auth/login", data={
        "username": "user2@example.com",
        "password": "wrong",
    })
    assert res.status_code == 401


def test_refresh(client):
    reg = client.post("/api/v1/auth/register", json={
        "email": "r@example.com",
        "password": "pass",
    }).json()
    res = client.post("/api/v1/auth/refresh", json={
        "refresh_token": reg["data"]["refresh_token"],
    })
    assert res.status_code == 200
    assert res.json()["data"]["access_token"]
