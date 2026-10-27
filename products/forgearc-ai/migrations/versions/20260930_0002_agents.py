"""Agent runs, human approvals, evaluations, and the usage feature column."""

import sqlalchemy as sa
from alembic import op

from forgearc_ai.models import AgentRunRow, ApprovalRow, Base, EvaluationRow

revision = "20260930_0002"
down_revision = "20260928_0001"
branch_labels = None
depends_on = None

TABLES = [AgentRunRow.__table__, ApprovalRow.__table__, EvaluationRow.__table__]


def upgrade():
    bind = op.get_bind()
    Base.metadata.create_all(bind, tables=TABLES)
    columns = {column["name"] for column in sa.inspect(bind).get_columns("usage_events")}
    if "feature" not in columns:
        op.add_column("usage_events", sa.Column("feature", sa.String(32), nullable=False, server_default="chat"))


def downgrade():
    op.drop_column("usage_events", "feature")
    Base.metadata.drop_all(op.get_bind(), tables=TABLES)
