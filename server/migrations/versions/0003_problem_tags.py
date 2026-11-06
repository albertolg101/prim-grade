"""problem tags (PL-41)

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('problems', sa.Column('tags', sa.JSON().with_variant(postgresql.JSONB(), 'postgresql'),
                                        nullable=False, server_default='[]'))


def downgrade() -> None:
    op.drop_column('problems', 'tags')
