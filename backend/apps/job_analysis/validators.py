"""
SkillBridge AI — Job & Goal Analysis Input Validators
Member 2 responsibility (Section 4, F1–F6 of the blueprint).

These are plain functions that take raw input and return either a clean value
or raise a ValidationError. Views call them before touching the database.

Rules:
  - All user input is treated as untrusted.
  - Use deterministic validation only (no AI calls here).
  - Raise rest_framework.exceptions.ValidationError so DRF converts it to a
    400 response automatically.
"""

from rest_framework.exceptions import ValidationError

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_JOB_TEXT_CHARS = 15_000   # ~3,000 words — enough for a real JD
MIN_JOB_TEXT_CHARS = 30       # At least a few words
MAX_GOAL_TEXT_CHARS = 500     # Goals should be concise
MIN_GOAL_TEXT_CHARS = 5       # "Python" is a valid goal

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


# ---------------------------------------------------------------------------
# Job description validators
# ---------------------------------------------------------------------------
def validate_job_text(job_text: str) -> str:
    """
    Validates and sanitises the job description text.
    Returns the stripped text on success, raises ValidationError on failure.
    """
    if not isinstance(job_text, str):
        raise ValidationError(
            {"job_text": "Job description must be a text string."}
        )

    cleaned = job_text.strip()

    if len(cleaned) == 0:
        raise ValidationError(
            {"job_text": "Job description cannot be empty."}
        )

    if len(cleaned) < MIN_JOB_TEXT_CHARS:
        raise ValidationError(
            {
                "job_text": (
                    f"Job description is too short ({len(cleaned)} characters). "
                    f"Please provide at least {MIN_JOB_TEXT_CHARS} characters so "
                    "the AI has enough context to extract meaningful requirements."
                )
            }
        )

    if len(cleaned) > MAX_JOB_TEXT_CHARS:
        raise ValidationError(
            {
                "job_text": (
                    f"Job description is too long ({len(cleaned):,} characters). "
                    f"Maximum allowed is {MAX_JOB_TEXT_CHARS:,} characters. "
                    "Please paste the core job description without company boilerplate."
                )
            }
        )

    return cleaned


def validate_job_image(job_image) -> None:
    """
    Validates an uploaded job screenshot file.
    Accepts a Django InMemoryUploadedFile or similar file object.
    Raises ValidationError on failure.
    """
    if job_image is None:
        return  # Image is optional — not providing one is fine

    content_type = getattr(job_image, "content_type", "")
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise ValidationError(
            {
                "job_image": (
                    f"Unsupported file type '{content_type}'. "
                    f"Allowed types: {', '.join(sorted(ALLOWED_IMAGE_TYPES))}."
                )
            }
        )

    size = getattr(job_image, "size", 0)
    if size > MAX_IMAGE_BYTES:
        raise ValidationError(
            {
                "job_image": (
                    f"Image file is too large ({size / 1024 / 1024:.1f} MB). "
                    f"Maximum allowed size is {MAX_IMAGE_BYTES // 1024 // 1024} MB."
                )
            }
        )


def validate_days_remaining(value) -> int:
    """
    Validates and coerces days_remaining to a positive integer.
    """
    try:
        days = int(value)
    except (TypeError, ValueError):
        raise ValidationError(
            {"days_remaining": "days_remaining must be a whole number (e.g. 14)."}
        )

    if days < 1:
        raise ValidationError(
            {"days_remaining": "days_remaining must be at least 1."}
        )

    if days > 365:
        raise ValidationError(
            {"days_remaining": "days_remaining cannot exceed 365 days."}
        )

    return days


def validate_study_hours(value) -> float:
    """
    Validates and coerces study_hours_per_week to a positive float.
    """
    try:
        hours = float(value)
    except (TypeError, ValueError):
        raise ValidationError(
            {
                "study_hours_per_week": (
                    "study_hours_per_week must be a number (e.g. 14.0)."
                )
            }
        )

    if hours <= 0:
        raise ValidationError(
            {"study_hours_per_week": "study_hours_per_week must be greater than 0."}
        )

    if hours > 168:
        # 168 = 24 * 7 — more than all hours in a week is physically impossible
        raise ValidationError(
            {
                "study_hours_per_week": (
                    "study_hours_per_week cannot exceed 168 (total hours in a week)."
                )
            }
        )

    return hours


# ---------------------------------------------------------------------------
# Goal validators
# ---------------------------------------------------------------------------
def validate_goal_text(goal_text: str) -> str:
    """
    Validates a career or skill goal string.
    Returns the stripped text on success, raises ValidationError on failure.
    """
    if not isinstance(goal_text, str):
        raise ValidationError({"goal_text": "Goal must be a text string."})

    cleaned = goal_text.strip()

    if len(cleaned) == 0:
        raise ValidationError({"goal_text": "Goal cannot be empty."})

    if len(cleaned) < MIN_GOAL_TEXT_CHARS:
        raise ValidationError(
            {
                "goal_text": (
                    f"Goal is too short ({len(cleaned)} characters). "
                    f"Please describe your goal in at least {MIN_GOAL_TEXT_CHARS} characters."
                )
            }
        )

    if len(cleaned) > MAX_GOAL_TEXT_CHARS:
        raise ValidationError(
            {
                "goal_text": (
                    f"Goal is too long ({len(cleaned)} characters). "
                    f"Please keep it under {MAX_GOAL_TEXT_CHARS} characters."
                )
            }
        )

    return cleaned


ALLOWED_GOAL_TYPES = {"job_opportunity", "career_role", "skill_goal"}


def validate_goal_type(goal_type: str) -> str:
    """
    Validates that goal_type is one of the allowed values.
    """
    if goal_type not in ALLOWED_GOAL_TYPES:
        raise ValidationError(
            {
                "goal_type": (
                    f"'{goal_type}' is not a valid goal type. "
                    f"Allowed values: {', '.join(sorted(ALLOWED_GOAL_TYPES))}."
                )
            }
        )
    return goal_type


# ---------------------------------------------------------------------------
# Requirement list validator (for the PATCH confirm/edit endpoint)
# ---------------------------------------------------------------------------
ALLOWED_CATEGORIES = {
    "language", "framework", "database", "testing", "devops", "tools", "concepts"
}
ALLOWED_IMPORTANCE = {"required", "preferred"}


def validate_requirement_item(item: dict, index: int) -> dict:
    """
    Validates a single requirement item from the user's edited list.
    `index` is used in error messages so the user knows which item failed.
    Returns a cleaned dict.
    """
    if not isinstance(item, dict):
        raise ValidationError(
            {f"requirements[{index}]": "Each requirement must be a JSON object."}
        )

    skill_name = item.get("skill_name", "")
    if not isinstance(skill_name, str) or not skill_name.strip():
        raise ValidationError(
            {f"requirements[{index}].skill_name": "skill_name is required and must be a non-empty string."}
        )

    category = item.get("category", "concepts")
    if category not in ALLOWED_CATEGORIES:
        # Coerce to 'concepts' rather than rejecting — user may have typed freely
        category = "concepts"

    importance = item.get("importance", "required")
    if importance not in ALLOWED_IMPORTANCE:
        raise ValidationError(
            {
                f"requirements[{index}].importance": (
                    f"'{importance}' is invalid. Use 'required' or 'preferred'."
                )
            }
        )

    source_excerpt = item.get("source_excerpt", "").strip()

    return {
        "requirement_id": item.get("requirement_id") or item.get("id") or "",
        "skill_name": skill_name.strip(),
        "category": category,
        "importance": importance,
        "source_excerpt": source_excerpt or f"User-confirmed skill: {skill_name.strip()}",
    }


def validate_requirements_list(requirements: list) -> list:
    """
    Validates the full list of requirements submitted during the review step.
    Returns a list of cleaned requirement dicts.
    """
    if not isinstance(requirements, list):
        raise ValidationError({"requirements": "requirements must be a JSON array."})

    if len(requirements) == 0:
        raise ValidationError(
            {"requirements": "At least one requirement must be kept."}
        )

    if len(requirements) > 50:
        raise ValidationError(
            {"requirements": "Cannot have more than 50 requirements in a single analysis."}
        )

    return [validate_requirement_item(item, i) for i, item in enumerate(requirements)]
