import sqlite3

import pytest

import database


def test_health_endpoint_success(client):
    response = client.get("/api/test")
    assert response.status_code == 200
    assert response.json() == {"message": "سلام، بک‌اند کار می‌کند"}


def test_health_endpoint_wrong_method_returns_405(client):
    response = client.post("/api/test")
    assert response.status_code == 405


def test_list_services_success_matches_prd(client):
    response = client.get("/api/services")
    assert response.status_code == 200
    services = response.json()
    assert len(services) == 4
    actual = [(s["name"], s["price"], s["duration"]) for s in services]
    assert actual == [
        ("اصلاح مو", 250000, 30),
        ("اصلاح مو و ریش", 350000, 60),
        ("رنگ مو", 900000, 90),
        ("شست‌وشو و حالت‌دهی", 150000, 30),
    ]


def test_services_endpoint_wrong_method_returns_405(client):
    response = client.post("/api/services", json={})
    assert response.status_code == 405


def test_foreign_keys_enabled_and_enforced_at_db_level(client, future_date):
    conn = database.get_connection()
    try:
        fk_enabled = conn.execute("PRAGMA foreign_keys").fetchone()[0]
        assert fk_enabled == 1
    finally:
        conn.close()

    with pytest.raises(sqlite3.IntegrityError):
        database.create_appointment(
            customer_name="تست کلید خارجی",
            customer_phone="09121234567",
            service_id=9999,
            service_name="نامعتبر",
            date=future_date,
            start_time="10:00",
        )
