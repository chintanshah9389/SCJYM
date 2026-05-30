"""Verify MongoDB Atlas URI/auth locally with clear diagnostics.

Usage (PowerShell):
  $env:MONGODB_URI="mongodb+srv://user:pass@cluster/db?retryWrites=true&w=majority"
  py -3 scripts/verify_mongo_uri.py

Or pass explicitly:
  py -3 scripts/verify_mongo_uri.py --uri "mongodb+srv://..."
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import List, Tuple
from urllib.parse import parse_qsl, quote_plus, unquote, urlencode, urlsplit, urlunsplit

from pymongo import MongoClient


def mask_uri(uri: str) -> str:
    try:
        scheme, rest = uri.split("://", 1)
        if "@" not in rest:
            return f"{scheme}://{rest}"
        creds, host = rest.split("@", 1)
        if ":" in creds:
            user, _pwd = creds.split(":", 1)
            return f"{scheme}://{user}:****@{host}"
        return f"{scheme}://****@{host}"
    except Exception:
        return "****"


def ensure_auth_source_admin(uri: str) -> str:
    parts = urlsplit(uri)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.setdefault("authSource", "admin")
    return urlunsplit(parts._replace(query=urlencode(query)))


def encode_password(uri: str) -> str:
    try:
        parts = urlsplit(uri)
        if "@" not in parts.netloc:
            return uri
        creds, host = parts.netloc.rsplit("@", 1)
        if ":" not in creds:
            return uri
        user, password = creds.split(":", 1)
        encoded = quote_plus(unquote(password), safe="")
        new_netloc = f"{user}:{encoded}@{host}"
        return urlunsplit(parts._replace(netloc=new_netloc))
    except Exception:
        return uri


def ping(uri: str) -> Tuple[bool, str]:
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=12000)
        out = client.admin.command("ping")
        return True, str(out)
    except Exception as exc:  # keep full message for diagnosis
        return False, f"{type(exc).__name__}: {exc}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify MongoDB Atlas URI and auth")
    parser.add_argument("--uri", help="MongoDB URI. If omitted, MONGODB_URI env var is used")
    args = parser.parse_args()

    raw = (args.uri or os.getenv("MONGODB_URI") or "").strip().strip('"').strip("'")
    if not raw:
        print("ERROR: No URI provided. Set MONGODB_URI or pass --uri")
        return 2

    candidates: List[Tuple[str, str]] = []
    base = raw
    admin = ensure_auth_source_admin(base)
    encoded = encode_password(base)
    encoded_admin = ensure_auth_source_admin(encoded)

    candidates.append(("base", base))
    if admin != base:
        candidates.append(("with_authSource_admin", admin))
    if encoded != base:
        candidates.append(("with_encoded_password", encoded))
    if encoded_admin not in {base, admin, encoded}:
        candidates.append(("encoded_password_plus_authSource_admin", encoded_admin))

    print("Testing MongoDB URI variants (masked):")
    for name, uri in candidates:
        print(f"- {name}: {mask_uri(uri)}")

    print()
    for name, uri in candidates:
        ok, result = ping(uri)
        if ok:
            print(f"PASS [{name}] {result}")
            print("\nConclusion: credentials/URI are valid with the PASS variant above.")
            return 0
        print(f"FAIL [{name}] {result}")

    print("\nConclusion: all variants failed. Most likely Atlas username/password is invalid.")
    print("Next: reset Atlas DB user password, update Render MONGODB_URI, and retest.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
