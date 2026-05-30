import httpx
import sys

base = "http://127.0.0.1:8000/api/v1"
client = httpx.Client(timeout=30.0)

try:
    print('[debug] login')
    r = client.post(f"{base}/auth/login", json={"email": "superadmin@example.com", "password": "SuperSecureP@ssw0rd!"})
    print('login ->', r.status_code, r.text)
    r.raise_for_status()
    token = r.json()['data']['accessToken']
    headers = {'Authorization': f'Bearer {token}'}

    print('[debug] create user')
    payload = {
        'fullName': 'CI Debug',
        'email': f'ci.debug.{__import__("random").randint(1000,9999)}@example.com',
        'mobile': '9' + str(__import__('random').randint(100000000, 999999999)),
        'address': {'line1': 'A', 'line2': '', 'city': 'City', 'state': 'State', 'pincode': '400001', 'country': 'IN'},
        'role': 'MEMBER',
        'status': 'APPROVED'
    }
    r = client.post(f"{base}/users", json=payload, headers=headers)
    print('create ->', r.status_code, r.text)
    r.raise_for_status()
    uid = r.json()['data']['user']['id']

    print('[debug] patch user fullName')
    r = client.patch(f"{base}/users/{uid}", json={'fullName': 'CI Patched'}, headers=headers)
    print('patch ->', r.status_code, r.text)

    print('[debug] delete user')
    r = client.delete(f"{base}/users/{uid}", headers=headers)
    print('delete ->', r.status_code, r.text)

except Exception as e:
    print('EXCEPTION:', e)
    sys.exit(1)
finally:
    client.close()
