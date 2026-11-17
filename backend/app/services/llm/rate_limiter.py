import time
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, status
from app.core.config import settings


class UserRateLimiter:
    """Sliding-window per-user rate limiter for AI Coach requests."""

    def __init__(self, max_requests: int = 20, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._history: Dict[str, List[float]] = defaultdict(list)

    def check_rate_limit(self, identifier: str) -> None:
        """
        Check if identifier (user_id or IP) has exceeded quota.
        Raises HTTPException(429) if exceeded.
        """
        now = time.time()
        cutoff = now - self.window_seconds

        # Clean old timestamps
        timestamps = [t for t in self._history[identifier] if t > cutoff]
        self._history[identifier] = timestamps

        if len(timestamps) >= self.max_requests:
            oldest_in_window = timestamps[0]
            retry_after = max(1, int(self.window_seconds - (now - oldest_in_window)))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. You can send up to {self.max_requests} requests per minute. Please try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )

        self._history[identifier].append(now)

    def reset_for(self, identifier: str) -> None:
        """Reset history for a given identifier (used primarily in tests)."""
        if identifier in self._history:
            del self._history[identifier]


coach_rate_limiter = UserRateLimiter(
    max_requests=settings.LLM_RATE_LIMIT_PER_MINUTE,
    window_seconds=60,
)
