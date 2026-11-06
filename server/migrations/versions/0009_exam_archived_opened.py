"""archive an exam, and when it was last opened (PL-56)

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from alembic import op

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('exams', sa.Column('archived', sa.Boolean(), nullable=False,
                                     server_default=sa.false()))
    op.add_column('exams', sa.Column('opened_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('exams', 'opened_at')
    op.drop_column('exams', 'archived')
