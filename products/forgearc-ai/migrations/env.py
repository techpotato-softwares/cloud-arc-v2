import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from forgearc_ai.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _database_url() -> str | None:
    return os.environ.get("DATABASE_URL") or None


def run_migrations_offline():
    url = _database_url() or config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    section = dict(config.get_section(config.config_ini_section) or {})
    url = _database_url()
    if url:
        section["sqlalchemy.url"] = url
    connectable = engine_from_config(section, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
