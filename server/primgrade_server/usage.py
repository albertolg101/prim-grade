"""PL-47, PL-51, PL-54, PL-56: when a problem, group or exam was last used."""

from sqlalchemy import func, select, union_all

from . import models


def last_used(db, model, answer_key, owner_id: str) -> dict:
    """Per row of `model` (keyed by `answer_key`, the answer's column pointing at it): the latest of
    when it was opened, and when one of its answers was uploaded, graded by the AI or approved."""
    a = models.Answer
    events = union_all(
        select(model.id.label("key"), model.opened_at.label("at")).where(
            model.opened_at.is_not(None)),
        select(answer_key, a.created_at),
        select(answer_key, models.Run.started_at).join(models.Run, models.Run.answer_id == a.id),
        select(answer_key, models.Approval.approved_at)
        .join(models.Approval, models.Approval.answer_id == a.id),
    ).subquery()
    return dict(db.execute(
        select(events.c.key, func.max(events.c.at))
        .join(model, model.id == events.c.key)
        .where(model.owner_id == owner_id).group_by(events.c.key)).all())
