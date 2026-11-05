import os

from alembic import context
from primgrade_server.models import Base
from sqlalchemy import create_engine

url = context.config.attributes.get("url") or os.environ.get(
    "DATABASE_URL", "postgresql+psycopg://primgrade:primgrade@localhost:5433/primgrade"
)
with create_engine(url).connect() as conn:
    context.configure(connection=conn, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
