import os
import re
import hashlib
from pathlib import Path
from typing import Tuple
from app.core.config import settings


class DocumentStorageManager:
    """
    Private local file storage manager for learning documents.
    Keeps private files organized by user and avoids public cloud image storage.
    """

    @classmethod
    def get_base_dir(cls) -> Path:
        base = Path(settings.DOCUMENT_STORAGE_DIR)
        if not base.is_absolute():
            # Resolve relative to backend directory
            base = Path(__file__).resolve().parent.parent.parent.parent / base
        base.mkdir(parents=True, exist_ok=True)
        return base

    @classmethod
    def sanitize_filename(cls, filename: str) -> str:
        """Sanitize filename to prevent directory traversal and remove unsafe chars."""
        clean = Path(filename).name
        clean = re.sub(r"[^\w\.-]", "_", clean)
        return clean or "document.bin"

    @classmethod
    def compute_sha256(cls, content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()

    @classmethod
    def save_file(cls, user_id: int, filename: str, content: bytes) -> Tuple[str, str]:
        """
        Saves file bytes to disk in user-scoped directory.
        Returns: (relative_storage_path, content_hash)
        """
        if len(content) > settings.MAX_DOCUMENT_SIZE_BYTES:
            max_mb = settings.MAX_DOCUMENT_SIZE_BYTES // (1024 * 1024)
            raise ValueError(f"File size exceeds maximum allowed limit ({max_mb} MB).")

        content_hash = cls.compute_sha256(content)
        sanitized = cls.sanitize_filename(filename)

        user_dir = cls.get_base_dir() / f"user_{user_id}"
        user_dir.mkdir(parents=True, exist_ok=True)

        target_file = user_dir / f"{content_hash[:12]}_{sanitized}"
        target_file.write_bytes(content)

        # Store path relative to base directory
        relative_path = f"user_{user_id}/{target_file.name}"
        return relative_path, content_hash

    @classmethod
    def read_file(cls, relative_storage_path: str) -> bytes:
        """Reads file bytes from storage."""
        full_path = cls.get_base_dir() / relative_storage_path
        if not full_path.exists():
            raise FileNotFoundError("Document file not found in storage.")
        return full_path.read_bytes()

    @classmethod
    def delete_file(cls, relative_storage_path: str) -> bool:
        """Deletes file from storage if present."""
        try:
            full_path = cls.get_base_dir() / relative_storage_path
            if full_path.exists():
                full_path.unlink()
                return True
        except Exception:
            pass
        return False
