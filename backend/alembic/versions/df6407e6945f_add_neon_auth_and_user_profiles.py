"""add_neon_auth_and_user_profiles

Revision ID: df6407e6945f
Revises: 125f2ad51c71
Create Date: 2026-10-21 16:54:59.545229

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'df6407e6945f'
down_revision: Union[str, Sequence[str], None] = '125f2ad51c71'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema safely with data preservation."""
    # Index on tasks.user_id
    try:
        op.create_index(op.f('ix_tasks_user_id'), 'tasks', ['user_id'], unique=False)
    except Exception:
        pass

    # Update tasks foreign key constraint to CASCADE delete
    try:
        op.drop_constraint('tasks_user_id_fkey', 'tasks', type_='foreignkey')
    except Exception:
        pass
    try:
        op.create_foreign_key('tasks_user_id_fkey', 'tasks', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    except Exception:
        pass

    # Add new user columns with safe server defaults to preserve existing data
    op.add_column('users', sa.Column('password_hash', sa.String(length=255), nullable=False, server_default=''))
    op.add_column('users', sa.Column('full_name', sa.String(length=100), nullable=True))
    
    # Safely migrate existing name data into full_name
    op.execute("UPDATE users SET full_name = COALESCE(name, 'Learner') WHERE full_name IS NULL")
    op.alter_column('users', 'full_name', nullable=False)

    op.add_column('users', sa.Column('account_type', sa.String(length=50), nullable=False, server_default='student'))
    op.add_column('users', sa.Column('education_level', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('institution', sa.String(length=200), nullable=True))
    op.add_column('users', sa.Column('learning_stage', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('current_role', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('experience_range', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('skill_level', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('is_onboarded', sa.Boolean(), nullable=False, server_default=sa.text('false')))

    op.alter_column('users', 'is_active', existing_type=sa.BOOLEAN(), nullable=False, server_default=sa.text('true'))
    op.create_index(op.f('ix_users_account_type'), 'users', ['account_type'], unique=False)
    
    # Drop legacy name column
    op.drop_column('users', 'name')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('users', sa.Column('name', sa.VARCHAR(length=100), autoincrement=False, nullable=True))
    op.execute("UPDATE users SET name = full_name")
    op.alter_column('users', 'name', nullable=False)
    
    op.drop_index(op.f('ix_users_account_type'), table_name='users')
    op.drop_column('users', 'is_onboarded')
    op.drop_column('users', 'skill_level')
    op.drop_column('users', 'experience_range')
    op.drop_column('users', 'current_role')
    op.drop_column('users', 'learning_stage')
    op.drop_column('users', 'institution')
    op.drop_column('users', 'education_level')
    op.drop_column('users', 'account_type')
    op.drop_column('users', 'full_name')
    op.drop_column('users', 'password_hash')
    
    try:
        op.drop_constraint('tasks_user_id_fkey', 'tasks', type_='foreignkey')
        op.create_foreign_key('tasks_user_id_fkey', 'tasks', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    except Exception:
        pass
    try:
        op.drop_index(op.f('ix_tasks_user_id'), table_name='tasks')
    except Exception:
        pass
