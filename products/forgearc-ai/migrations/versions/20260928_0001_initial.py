"""Tenant-scoped ForgeArc AI tables. PostgreSQL also enables pgvector."""

from alembic import op

from forgearc_ai.models import Base
from forgearc_ai.rag import postgres_search_sql

revision = "20260928_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    Base.metadata.create_all(bind)
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
        op.execute("ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding_vec vector(1536)")
    assert "tenant_id" in postgres_search_sql()


def downgrade():
    bind = op.get_bind()
    Base.metadata.drop_all(bind)
