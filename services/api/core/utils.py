"""Utility helpers: ObjectId serialization, pagination, response envelope."""
from bson import ObjectId
from typing import Any


def serialize_doc(doc: dict | None) -> dict | None:
    """Convert MongoDB _id ObjectId to string id."""
    if doc is None:
        return None
    out = {k: v for k, v in doc.items() if k != "_id"}
    out["id"] = str(doc["_id"])
    return out


def serialize_list(docs: list[dict]) -> list[dict]:
    return [serialize_doc(d) for d in docs if d is not None]


def ok(data: Any) -> dict:
    return {"success": True, "data": data, "error": None}


def err(code: str, message: str, details: list | None = None) -> dict:
    return {
        "success": False,
        "data": None,
        "error": {"code": code, "message": message, "details": details or []},
    }


def paginate_response(items: list, page: int, limit: int, total: int) -> dict:
    import math
    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total": total,
        "totalPages": math.ceil(total / limit) if limit else 0,
    }
