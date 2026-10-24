"""
SkillBridge AI — Goal Mapper (Mode B)
Maps a free-text career or skill goal to the best-matching skill profile.

Design:
  - Scores every profile against the goal by counting keyword hits.
  - Ties are broken by which profile's keywords appear earliest in the text.
  - Returns the best match with a confidence level and an optional user warning.
  - Fully deterministic — no AI calls.
  - Supports all profiles defined in services/skill_profiles.py automatically.
"""

from dataclasses import dataclass, field
from typing import List, Optional

from services.skill_profiles import SKILL_PROFILES


@dataclass
class MappingResult:
    profile_id: str
    role_title: str
    confidence: str          # 'high' | 'medium' | 'low'
    matched_keywords: List[str] = field(default_factory=list)
    warning: Optional[str] = None
    requirements: List[dict] = field(default_factory=list)


def map_goal_to_profile(goal_text: str) -> MappingResult:
    """
    Scores all profiles against the goal text and returns the best match.

    Confidence rules:
      ≥ 3 keyword hits → high
      1–2 keyword hits → medium
      0 hits           → low  (default = most general role = junior backend)
                               Warning is added so the user knows.

    When two profiles tie on keyword count, the one whose first keyword
    appears earlier in the goal text wins (position tiebreak).
    """
    lower_goal = goal_text.lower()

    best_profile_id: str = "prof_junior_backend"
    best_count: int = 0
    best_keywords: List[str] = []
    best_first_pos: int = len(lower_goal) + 1  # position tiebreak

    for profile_id, profile in SKILL_PROFILES.items():
        matched: List[str] = []
        first_pos = len(lower_goal) + 1

        for kw in profile["keywords"]:
            pos = lower_goal.find(kw)
            if pos != -1:
                matched.append(kw)
                if pos < first_pos:
                    first_pos = pos

        count = len(matched)
        # Better score, or same score but keyword appears earlier
        if count > best_count or (count == best_count > 0 and first_pos < best_first_pos):
            best_count = count
            best_profile_id = profile_id
            best_keywords = matched
            best_first_pos = first_pos

    matched_profile = SKILL_PROFILES[best_profile_id]

    # Confidence level
    if best_count == 0:
        confidence = "low"
        warning = (
            "Your goal didn't clearly match a specific role profile. "
            f"We've defaulted to '{matched_profile['role_title']}'. "
            "Please review the requirements below and remove any that don't apply, "
            "or try a more specific goal such as 'Frontend Developer using React' "
            "or 'Machine Learning Engineer with Python'."
        )
    elif best_count <= 2:
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
