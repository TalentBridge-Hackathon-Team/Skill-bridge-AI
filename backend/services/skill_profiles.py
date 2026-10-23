"""
SkillBridge AI — Predefined Skill Profiles
Used by Mode B (Goal-Based) to map career goals to structured skill requirements
when no job description is provided.

Supported profiles:
  - prof_junior_backend: Junior Backend Developer / Backend Internship

To add a new profile in the future, add an entry to SKILL_PROFILES following
the same structure. Goal mapper will automatically discover it.
"""

from typing import Dict, Any, List

# Each requirement dict mirrors the Requirement model fields so views can
# create Requirement objects directly from these lists.
SKILL_PROFILES: Dict[str, Dict[str, Any]] = {
    "prof_junior_backend": {
        "profile_id": "prof_junior_backend",
        "role_title": "Junior Backend Developer",
        "description": (
            "Entry-level backend engineering role targeting Python/Django REST "
            "API development, database management, and basic DevOps practices."
        ),
        # Keywords that should match this profile when a user types a goal.
        # Matching is case-insensitive substring / word match.
        "keywords": [
            "backend",
            "back-end",
            "back end",
            "python",
            "django",
            "rest api",
            "api developer",
            "junior developer",
            "junior engineer",
            "backend internship",
            "software developer",
            "web developer",
            "server side",
            "server-side",
        ],
        "requirements": [
            {
                "skill_name": "Python",
                "category": "language",
                "importance": "required",
                "source_excerpt": (
                    "Core language for all backend services, scripting, and tooling "
                    "in a Junior Backend Developer role."
                ),
            },
            {
                "skill_name": "Django REST Framework",
                "category": "framework",
                "importance": "required",
                "source_excerpt": (
                    "Standard framework for building RESTful APIs in Python; expected "
                    "across the majority of Junior Backend Developer postings."
                ),
            },
            {
                "skill_name": "PostgreSQL",
                "category": "database",
                "importance": "required",
                "source_excerpt": (
                    "Relational database management including schema design, query "
                    "optimisation, and indexing for production backends."
                ),
            },
            {
                "skill_name": "API Testing",
                "category": "testing",
                "importance": "required",
                "source_excerpt": (
                    "Writing and maintaining unit, integration, and end-to-end tests "
                    "for REST API endpoints using pytest / pytest-django."
                ),
            },
            {
                "skill_name": "Git",
                "category": "tools",
                "importance": "required",
                "source_excerpt": (
                    "Version control with Git and collaborative workflows using "
                    "GitHub/GitLab pull requests and code reviews."
                ),
            },
            {
                "skill_name": "Docker",
                "category": "devops",
                "importance": "preferred",
                "source_excerpt": (
                    "Containerising applications with Docker for consistent "
                    "development and deployment environments."
                ),
            },
            {
                "skill_name": "RESTful API Design",
                "category": "concepts",
                "importance": "required",
                "source_excerpt": (
                    "Understanding HTTP verbs, status codes, resource naming, "
                    "pagination, and error handling conventions."
                ),
            },
            {
                "skill_name": "SQL",
                "category": "database",
                "importance": "required",
                "source_excerpt": (
                    "Writing and reading data using standard SQL including JOINs, "
                    "aggregations, and sub-queries."
                ),
            },
        ],
    }
}


def get_profile(profile_id: str) -> Dict[str, Any]:
    """
    Returns a skill profile by its ID.
    Raises KeyError if the profile_id does not exist.
    """
    return SKILL_PROFILES[profile_id]


def list_profiles() -> List[Dict[str, Any]]:
    """
    Returns summary metadata for all supported profiles (without the full
    requirements list), useful for building a profile picker UI.
    """
    return [
        {
            "profile_id": p["profile_id"],
            "role_title": p["role_title"],
            "description": p["description"],
        }
        for p in SKILL_PROFILES.values()
    ]
