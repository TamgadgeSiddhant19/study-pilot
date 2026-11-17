import asyncio
from logging.config import fileConfig
import sys
import os

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings
from app.core.database import Base
import app.models  # load all models for metadata discovery

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def get_migration_url() -> str:
    """Get direct unpooled database connection string for safe DDL migration execution."""
    if settings.DIRECT_DATABASE_URL:
        return settings.DIRECT_DATABASE_URL
    url = settings.DATABASE_URL
    # For Neon: pooler endpoints (-pooler.) should be converted to direct host for migrations
    if "-pooler." in url:
        return url.replace("-pooler.", ".")
    return url


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode using the async engine (asyncpg / aiosqlite)."""
    migration_url = get_migration_url()
    engine_kwargs = {
        "poolclass": pool.NullPool,
    }
    if migration_url.startswith("sqlite"):
        engine_kwargs["connect_args"] = {"check_same_thread": False}

    connectable = create_async_engine(migration_url, **engine_kwargs)

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
        await connection.commit()

    await connectable.dispose()


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_migration_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
