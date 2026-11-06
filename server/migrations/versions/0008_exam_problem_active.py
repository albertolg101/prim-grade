"""an exam's problem can be switched off instead of removed (PL-55)

Revision ID: 0008
Revises: 0007
"""

import sqlalchemy as sa
from alembic import op

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('exam_problems', sa.Column('active', sa.Boolean(), nullable=False,
                                             server_default=sa.true()))


def downgrade() -> None:
    op.drop_column('exam_problems', 'active')
