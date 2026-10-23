"""
SkillBridge AI — Goal Mapper (Mode B)
Maps a free-text career or skill goal to a supported skill profile.

Design:
  - Uses keyword matching against each profile's keyword list.
  - Returns a MappingResult dataclass with the matched profile (or the default
    if nothing matches) plus a confidence level and a user-facing warning when
    the match is ambiguous.
  - Deterministic — no AI calls. AI is used only for job description extraction
    in Mode A.
  - If multiple profiles match, picks the one with the highest keyword hit count.
  - If no keywords match at all, defaults to prof_junior_backend but sets
    confidence to 'low' and includes a warning so the UI can display it.
"""

from dataclasses import dataclass, field
from typing import List, Optional

from services.skill_profiles import SKILL_PROFILES


@dataclass
class MappingResult:
    """
    Result of mapping a goal string to a skill profile.

    Fields:
      profile_id       — The matched profile identifier.
      role_title       — Human-readable role title for the matched profile.
      confidence       — 'high', 'medium', or 'low'.
      matched_keywords — Keywords from the goal that triggered the match.
      warning          — Optional user-facing message shown in the UI when
                         confidence is low (ambiguous goal).
      requirements     — The full requirement list from the matched profile,
                         ready for saving to the database.
    """

    profile_id: str
    role_title: str
    confidence: str  # 'high' | 'medium' | 'low'
    matched_keywords: List[str] = field(default_factory=list)
    warning: Optional[str] = None
    requirements: List[dict] = field(default_factory=list)


def map_goal_to_profile(goal_text: str) -> MappingResult:
    """
    Maps a free-text goal to the best-matching supported profile.

    Scoring rules:
      - For each profile, count how many of its keywords appear in the goal.
      - Pick the profile with the highest count.
      - If the count is 0 → low confidence, default profile, warning shown.
      - If the count is 1 → medium confidence, no warning.
      - If the count ≥ 2 → high confidence.

    Example:
      "I want to become a junior backend developer using Python and Django"
      → hits: backend, junior developer, python, django
      → profile: prof_junior_backend, confidence: high
    """
    lower_goal = goal_text.lower()

    best_profile_id: str = "prof_junior_backend"  # default
    best_count: int = 0
    best_keywords: List[str] = []

    for profile_id, profile in SKILL_PROFILES.items():
        matched: List[str] = []
        for kw in profile["keywords"]:
            if kw in lower_goal:
                matched.append(kw)

        if len(matched) > best_count:
            best_count = len(matched)
            best_profile_id = profile_id
            best_keywords = matched

    matched_profile = SKILL_PROFILES[best_profile_id]

    # Determine confidence level
    if best_count == 0:
        confidence = "low"
        warning = (
            "Your goal didn't clearly match a specific role profile. "
            "We've defaulted to the Junior Backend Developer profile. "
            "Please review the requirements below and remove any that don't apply, "
            "or change your goal to be more specific (e.g. 'Junior Backend Developer in Python')."
        )
    elif best_count == 1:
        confidence = "medium"
        warning = None
    else:
        confidence = "high"
        warning = None

    return MappingResult(
        profile_id=best_profile_id,
        role_title=matched_profile["role_title"],
        confidence=confidence,
        matched_keywords=best_keywords,
        warning=warning,
        requirements=matched_profile["requirements"],
    )
