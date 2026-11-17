from datetime import datetime, timedelta, timezone
from typing import Tuple


def calculate_sm2(
    quality: int,
    repetitions: int,
    ease_factor: float,
    interval_days: int
) -> Tuple[int, int, float, datetime]:
    """
    SuperMemo-2 (SM-2) algorithm for algorithmic problem revision.
    
    Args:
        quality: User performance score 0 to 5.
            5: Perfect response / immediate recall
            4: Correct response after hesitation
            3: Correct response recalled with serious difficulty
            2: Incorrect response; where the correct one seemed easy to recall
            1: Incorrect response; the correct one remembered
            0: Complete blackout
        repetitions: Current repetition count.
        ease_factor: Current easiness factor (minimum 1.3).
        interval_days: Current interval in days.

    Returns:
        (new_repetitions, new_interval_days, new_ease_factor, next_review_datetime)
    """
    quality = max(0, min(5, quality))
    
    if quality < 3:
        # Failure: reset repetition cycle
        new_repetitions = 0
        new_interval_days = 1
    else:
        # Success
        if repetitions == 0:
            new_interval_days = 1
        elif repetitions == 1:
            new_interval_days = 6
        else:
            new_interval_days = max(1, round(interval_days * ease_factor))
        new_repetitions = repetitions + 1

    # Update ease factor
    # EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    new_ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ease_factor = max(1.3, round(new_ease_factor, 2))

    next_review = datetime.now(timezone.utc) + timedelta(days=new_interval_days)

    return new_repetitions, new_interval_days, new_ease_factor, next_review
