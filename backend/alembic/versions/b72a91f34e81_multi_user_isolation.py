"""multi_user_isolation

Revision ID: b72a91f34e81
Revises: e8f491c2b3d0
Create Date: 2026-10-29 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b72a91f34e81'
down_revision: Union[str, Sequence[str], None] = 'e8f491c2b3d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Study Sessions - Add user_id column, foreign key, index
    op.execute("ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS user_id INTEGER;")
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_sessions_user_id'
            ) THEN
                ALTER TABLE study_sessions
                ADD CONSTRAINT fk_study_sessions_user_id
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            END IF;
        END $$;
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_study_sessions_user_id ON study_sessions(user_id);")

    # Backfill sessions linked to tasks
    op.execute("""
        UPDATE study_sessions
        SET user_id = tasks.user_id
        FROM tasks
        WHERE study_sessions.task_id = tasks.id
          AND study_sessions.user_id IS NULL;
    """)

    # 2. LeetCode Problems - Ensure user_id column, foreign key, and index
    op.execute("ALTER TABLE leetcode_problems ADD COLUMN IF NOT EXISTS user_id INTEGER;")
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_leetcode_problems_user_id'
            ) THEN
                ALTER TABLE leetcode_problems
                ADD CONSTRAINT fk_leetcode_problems_user_id
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            END IF;
        END $$;
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_leetcode_problems_user_id ON leetcode_problems(user_id);")

    # 3. Learning Resources - Add user_id column, foreign key, index
    op.execute("ALTER TABLE learning_resources ADD COLUMN IF NOT EXISTS user_id INTEGER;")
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_learning_resources_user_id'
            ) THEN
                ALTER TABLE learning_resources
                ADD CONSTRAINT fk_learning_resources_user_id
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            END IF;
        END $$;
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_learning_resources_user_id ON learning_resources(user_id);")

    # 4. Coach Conversations - Add user_id column, foreign key, index
    op.execute("ALTER TABLE coach_conversations ADD COLUMN IF NOT EXISTS user_id INTEGER;")
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_coach_conversations_user_id'
            ) THEN
                ALTER TABLE coach_conversations
                ADD CONSTRAINT fk_coach_conversations_user_id
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            END IF;
        END $$;
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_coach_conversations_user_id ON coach_conversations(user_id);")

    # 5. User Topic Progress - Create table for per-user roadmap mastery
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_topic_progress (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            topic_id INTEGER NOT NULL REFERENCES roadmap_topics(id) ON DELETE CASCADE,
            status VARCHAR(20) NOT NULL DEFAULT 'not_started',
            mastery_percentage INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            CONSTRAINT uq_user_topic_progress UNIQUE (user_id, topic_id)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_topic_progress_user_id ON user_topic_progress(user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_topic_progress_topic_id ON user_topic_progress(topic_id);")


def downgrade() -> None:
    # 5. Drop user_topic_progress
    op.execute("DROP TABLE IF EXISTS user_topic_progress;")

    # 4. Coach Conversations
    op.execute("ALTER TABLE coach_conversations DROP CONSTRAINT IF EXISTS fk_coach_conversations_user_id;")
    op.execute("DROP INDEX IF EXISTS ix_coach_conversations_user_id;")
    op.execute("ALTER TABLE coach_conversations DROP COLUMN IF EXISTS user_id;")

    # 3. Learning Resources
    op.execute("ALTER TABLE learning_resources DROP CONSTRAINT IF EXISTS fk_learning_resources_user_id;")
    op.execute("DROP INDEX IF EXISTS ix_learning_resources_user_id;")
    op.execute("ALTER TABLE learning_resources DROP COLUMN IF EXISTS user_id;")

    # 2. LeetCode Problems
    op.execute("ALTER TABLE leetcode_problems DROP CONSTRAINT IF EXISTS fk_leetcode_problems_user_id;")
    op.execute("DROP INDEX IF EXISTS ix_leetcode_problems_user_id;")
    op.execute("ALTER TABLE leetcode_problems DROP COLUMN IF EXISTS user_id;")

    # 1. Study Sessions
    op.execute("ALTER TABLE study_sessions DROP CONSTRAINT IF EXISTS fk_study_sessions_user_id;")
    op.execute("DROP INDEX IF EXISTS ix_study_sessions_user_id;")
    op.execute("ALTER TABLE study_sessions DROP COLUMN IF EXISTS user_id;")
