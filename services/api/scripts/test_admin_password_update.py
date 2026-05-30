"""Automated test for admin password update endpoint.

Usage (from repo):
  cd services/api
  .\venv\Scripts\python.exe -m scripts.test_admin_password_update

This script will:
 - wait for the API at http://127.0.0.1:8000
 - login as superadmin
 - find user `aarav@example.com`
 - call PATCH /users/{id}/password
 - attempt login as the user with the new password
"""
import sys
import time
import httpx

BASE = "http://127.0.0.1:8000/api/v1"
HEALTH = "http://127.0.0.1:8000/health"
ADMIN_EMAIL = "superadmin@example.com"
ADMIN_PASSWORD = "SuperSecureP@ssw0rd!"
TARGET_EMAIL = "aarav@example.com"
NEW_PASSWORD = "TestPass!234"


def wait_for_server(timeout=15):
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = httpx.get(HEALTH, timeout=1.0)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def main():
    if not wait_for_server():
        print("[test] server not responding at http://127.0.0.1:8000")
        sys.exit(2)

    with httpx.Client() as client:
        # Admin login
        r = client.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
        if r.status_code != 200:
            print("[test] admin login failed:", r.status_code, r.text)
            sys.exit(3)
        token = r.json().get("data", {}).get("accessToken")
        if not token:
            print("[test] no accessToken in admin login response", r.text)
            sys.exit(4)
        headers = {"Authorization": f"Bearer {token}"}

        # Find target user
        r = client.get(f"{BASE}/users", params={"q": TARGET_EMAIL, "limit": 100}, headers=headers, timeout=10)
        if r.status_code != 200:
            print("[test] failed to list users:", r.status_code, r.text)
            sys.exit(5)
        items = r.json().get("data", {}).get("items", [])
        target = [u for u in items if u.get("email") == TARGET_EMAIL]
        if not target:
            print("[test] target user not found", TARGET_EMAIL)
            sys.exit(6)
        user_id = target[0].get("id")
        print("[test] found user", TARGET_EMAIL, "id=", user_id)

        # Update password
        r = client.patch(f"{BASE}/users/{user_id}/password", json={"newPassword": NEW_PASSWORD}, headers=headers, timeout=10)
        if r.status_code != 200:
            print("[test] password update failed:", r.status_code, r.text)
            sys.exit(7)
        print("[test] password update response:", r.json())

        # Login as user with new password
        r = client.post(f"{BASE}/auth/login", json={"email": TARGET_EMAIL, "password": NEW_PASSWORD}, timeout=10)
        if r.status_code != 200:
            print("[test] user login with new password failed:", r.status_code, r.text)
            sys.exit(8)
        print("[test] user login successful, tokens keys:", list(r.json().get("data", {}).keys()))
        print("[test] SUCCESS")
        sys.exit(0)


if __name__ == "__main__":
    main()
