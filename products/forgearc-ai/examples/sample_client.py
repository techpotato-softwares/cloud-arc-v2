"""Small buyer client for the local ForgeArc AI API."""

from __future__ import annotations

import json
import sys
import urllib.request


def request(base: str, method: str, path: str, token: str = "", body=None, multipart=None):
    data = None
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())


def main() -> None:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4020"
    email = sys.argv[2] if len(sys.argv) > 2 else "admin@forgearc.dev"
    password = sys.argv[3] if len(sys.argv) > 3 else "change-me"
    token = request(base, "POST", "/api/auth/login", body={"email": email, "password": password})["token"]
    print(json.dumps(request(base, "GET", "/api/usage", token), indent=2))


if __name__ == "__main__":
    main()
