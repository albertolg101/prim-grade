"""problem preparation runs in the background (PL-43)

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from alembic import op

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('problems', sa.Column('preparing_since', sa.DateTime(timezone=True)))
    op.add_column('problems', sa.Column('prepare_error', sa.Text()))


def downgrade() -> None:
    op.drop_column('problems', 'prepare_error')
    op.drop_column('problems', 'preparing_since')
