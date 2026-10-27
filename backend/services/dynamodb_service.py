"""
SkillBridge AI - Profile Data Access (Neon PostgreSQL)
DynamoDB integration has been deprecated and completely removed.
Neon PostgreSQL serves as the primary and single data store for all user profiles,
skills, projects, evidence, assessments, roadmaps, and requirements.
"""

import logging
from typing import Any, Dict, Optional, List

logger = logging.getLogger(__name__)


def put_profile(profile_data: Dict[str, Any]) -> bool:
    """No-op: All profile persistence is handled by Neon PostgreSQL."""
    return True


def get_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """No-op: Profiles are retrieved directly from Neon PostgreSQL via UserProfile model."""
    return None


def put_project(user_id: str, project_data: Dict[str, Any]) -> bool:
    """No-op: Projects are persisted in UserProfile.project_descriptions in PostgreSQL."""
    return True


def get_skills_by_prefix(user_id: str, prefix: str = "") -> List[Dict[str, Any]]:
    """No-op: Skills and evidence are queried via SkillEvidence in PostgreSQL."""
    return []
