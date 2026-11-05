"""a teacher's tags exist on their own (PL-41)

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'tags',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('owner_id', sa.String(length=32), nullable=False),
        sa.Column('name', sa.String(length=40), nullable=False),
        sa.Column('key', sa.String(length=40), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('owner_id', 'key'),
    )
    op.create_index(op.f('ix_tags_owner_id'), 'tags', ['owner_id'], unique=False)
    # tags already on problems become stored tags
    op.execute("""
        insert into tags (owner_id, name, key, created_at)
        select distinct on (owner_id, lower(t)) owner_id, t, lower(t), now()
        from problems, jsonb_array_elements_text(tags) as t
        order by owner_id, lower(t), created_at
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_tags_owner_id'), table_name='tags')
    op.drop_table('tags')
