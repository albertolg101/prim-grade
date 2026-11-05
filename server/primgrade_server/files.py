"""Store uploaded pages and raw camera captures unchanged (PL-12–14, I4)."""

import hashlib
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from . import models

TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
MIME_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_BYTES = 20 * 1024 * 1024


def _ext(upload: UploadFile) -> str:
    ext = Path(upload.filename or "").suffix.lower()
    if ext in TYPES:
        return ext
    if upload.content_type in MIME_EXT:
        return MIME_EXT[upload.content_type]
    raise HTTPException(422, f"unsupported file type: {upload.filename!r} (use JPG, PNG or WebP)")


async def read_checked(upload: UploadFile) -> tuple[bytes, str]:
    """Validate before anything is stored, so a refused submission stores nothing (PL-35)."""
    ext = _ext(upload)
    data = await upload.read()
    if not data:
        raise HTTPException(422, f"empty file: {upload.filename!r}")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, f"file too large: {upload.filename!r} (max 20 MB)")
    return data, ext


def save(
    db: Session,
    storage: Path,
    owner_id: str,
    data: bytes,
    ext: str,
    name: str,
    kind: str,
    derived_from: str | None = None,
) -> models.File:
    f = models.File(
        id=models.new_id(),
        owner_id=owner_id,
        kind=kind,
        sha256=hashlib.sha256(data).hexdigest(),
        mime=TYPES[ext],
        size=len(data),
        original_name=(name or f"page{ext}")[:255],
        derived_from=derived_from,
    )
    path = storage / owner_id / f"{f.id}{ext}"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "xb") as out:  # "x": never overwrite an existing file
        out.write(data)
    f.path = str(path)
    db.add(f)
    return f


async def read_pages(
    pages: list[UploadFile], captures: list[UploadFile], capture_of: list[int]
) -> list[tuple[tuple[bytes, str, str], tuple[bytes, str, str] | None]]:
    """Read and validate every page and its optional raw capture (capture_of[i] = page index)."""
    if not pages:
        raise HTTPException(422, "add at least one page")
    if len(captures) != len(capture_of):
        raise HTTPException(422, "each capture needs the index of its page")
    if any(not 0 <= i < len(pages) for i in capture_of) or len(set(capture_of)) != len(capture_of):
        raise HTTPException(422, "capture page indexes are out of range or repeated")
    read = [(*(await read_checked(p)), p.filename or "") for p in pages]
    caps = {i: (*(await read_checked(c)), c.filename or "")
            for i, c in zip(capture_of, captures, strict=True)}
    return [(read[i], caps.get(i)) for i in range(len(pages))]


def save_pages(db: Session, storage: Path, owner_id: str, checked) -> list[models.File]:
    """A scanned page is a derived file linked to its raw capture; both are kept (PL-14)."""
    out = []
    for (data, ext, name), cap in checked:
        source = None
        if cap is not None:
            source = save(db, storage, owner_id, cap[0], cap[1], cap[2], "capture")
            db.flush()
        out.append(
            save(db, storage, owner_id, data, ext, name, "scan" if source else "original",
                 source.id if source else None)
        )
    db.flush()
    return out
