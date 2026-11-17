"""create_coach_action_proposals

Revision ID: c18e47a91d22
Revises: b72a91f34e81
Create Date: 2026-10-29 17:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c18e47a91d22'
down_revision: Union[str, Sequence[str], None] = 'b72a91f34e81'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS coach_action_proposals (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            conversation_id INTEGER,
            action_type VARCHAR(50) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            summary TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            executed_at TIMESTAMP WITH TIME ZONE
        );
    """)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_coach_action_proposals_user_id'
            ) THEN
                ALTER TABLE coach_action_proposals
                ADD CONSTRAINT fk_coach_action_proposals_user_id
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            END IF;
        END $$;
    """)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_coach_action_proposals_conv_id'
            ) THEN
                ALTER TABLE coach_action_proposals
                ADD CONSTRAINT fk_coach_action_proposals_conv_id
                FOREIGN KEY (conversation_id) REFERENCES coach_conversations(id) ON DELETE CASCADE;
            END IF;
        END $$;
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_coach_action_proposals_user_id ON coach_action_proposals(user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_coach_action_proposals_conv_id ON coach_action_proposals(conversation_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_coach_action_proposals_status ON coach_action_proposals(status);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS coach_action_proposals CASCADE;")

