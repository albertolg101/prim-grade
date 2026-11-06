"""when a problem or group page was last opened (PL-54)

Revision ID: 0007
Revises: 0006
"""

import sqlalchemy as sa
from alembic import op

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ('problems', 'groups'):
        op.add_column(table, sa.Column('opened_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    for table in ('problems', 'groups'):
        op.drop_column(table, 'opened_at')
