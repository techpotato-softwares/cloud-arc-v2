"""Initial schema from SQLModel metadata."""
revision = "20260816_0001"
down_revision = None
branch_labels = None
depends_on = None

from alembic import op
import database.models  # noqa: F401
from database.models import SQLModel


def upgrade() -> None:
    bind = op.get_bind()
    SQLModel.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    SQLModel.metadata.drop_all(bind=bind)
