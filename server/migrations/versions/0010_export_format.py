"""the teacher's default format for exporting marks (PL-61)

Revision ID: 0010
Revises: 0009
"""

import sqlalchemy as sa
from alembic import op

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('export_format', sa.String(4), nullable=False,
                                     server_default='xlsx'))


def downgrade() -> None:
    op.drop_column('users', 'export_format')
