"""Durable conversations, run versions, and repository constraints."""

from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

from forgearc_ai.models import ConversationMessageRow, WebhookEventRow

revision = "20260930_0003"
down_revision = "20260930_0002"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "conversation_messages" not in tables:
        ConversationMessageRow.__table__.create(bind)
    if "webhook_events" not in tables:
        WebhookEventRow.__table__.create(bind)

    run_columns = {
        column["name"]
        for column in inspector.get_columns("agent_runs")
    }
    if "version" not in run_columns:
        op.add_column(
            "agent_runs",
            sa.Column(
                "version",
                sa.Integer(),
                nullable=False,
                server_default="1",
            ),
        )
    if "updated_at" not in run_columns:
        op.add_column(
            "agent_runs",
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )

    if bind.dialect.name == "postgresql":
        op.execute(
            "ALTER TABLE chunks ALTER COLUMN embedding_vec "
            "TYPE vector USING embedding_vec::vector"
        )
        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS "
            "uq_jobs_tenant_idempotency "
            "ON jobs (tenant_id, idempotency_key)"
        )
        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS "
            "uq_approvals_pending_run_tool "
            "ON approvals (run_id, tool) WHERE status = 'pending'"
        )
    else:
        # SQLite test databases created from current metadata already contain
        # constraints. Existing SQLite databases are development-only.
        op.execute(
            "UPDATE agent_runs SET updated_at = "
            f"'{datetime.now(UTC).isoformat()}' "
            "WHERE updated_at IS NULL"
        )


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS uq_approvals_pending_run_tool")
        op.execute("DROP INDEX IF EXISTS uq_jobs_tenant_idempotency")
    columns = {
        column["name"]
        for column in sa.inspect(bind).get_columns("agent_runs")
    }
    if "updated_at" in columns:
        op.drop_column("agent_runs", "updated_at")
    if "version" in columns:
        op.drop_column("agent_runs", "version")
    WebhookEventRow.__table__.drop(bind, checkfirst=True)
    ConversationMessageRow.__table__.drop(bind, checkfirst=True)
