"""PL-25: groups (a class or a section); their students are the names that submitted."""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import select

from .. import models
from ..deps import Db, Teacher, owned

router = APIRouter(prefix="/api/groups", tags=["groups"])


class GroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class GroupEdit(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    archived: bool | None = None


def group_out(db, g: models.Group) -> dict:
    students = db.scalars(select(models.Answer.student_name).distinct().where(
        models.Answer.group_id == g.id, models.Answer.student_name != "")
        .order_by(models.Answer.student_name)).all()
    return {"id": g.id, "name": g.name, "archived": g.archived, "students": students,
            "created_at": g.created_at.isoformat()}  # PL-49: the answer filter offers the newest first


@router.get("")
def list_groups(db: Db, user: Teacher) -> list[dict]:
    rows = db.scalars(select(models.Group).where(models.Group.owner_id == user.id)
                      .order_by(models.Group.archived, models.Group.name)).all()
    return [group_out(db, g) for g in rows]


@router.post("", status_code=201)
def new_group(body: GroupIn, db: Db, user: Teacher) -> dict:
    g = models.Group(owner_id=user.id, name=body.name.strip())
    db.add(g)
    db.commit()
    return group_out(db, g)


@router.patch("/{group_id}")
def edit_group(group_id: str, body: GroupEdit, db: Db, user: Teacher) -> dict:
    g = owned(db, models.Group, group_id, user)
    if body.name is not None:
        g.name = body.name.strip()
    if body.archived is not None:
        g.archived = body.archived
    db.commit()
    return group_out(db, g)
