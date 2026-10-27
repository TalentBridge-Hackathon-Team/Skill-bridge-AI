"""
Rubric Evaluator Service
Bridges legacy imports directly to the fully-integrated RubricEvaluator in apps.assessments.evaluator.
"""

from typing import Dict, Any
from apps.assessments.evaluator import RubricEvaluator as CoreRubricEvaluator, SKILL_RUBRIC_SPECS, GENERIC_FALLBACK_RUBRIC

class RubricEvaluator(CoreRubricEvaluator):
    """Integrated 10-point Rubric Evaluator service."""

    @staticmethod
    def evaluate_api_testing(submission: Dict[str, Any]) -> Dict[str, Any]:
        """
        Backward-compatible evaluation helper for API Testing.
        Delegates directly to the live rubric engine.
        """
        engine = CoreRubricEvaluator()
        task_id = submission.get("task_id", "task_api_testing")
        user_id = submission.get("user_id", "demo_user")
        sub_type = submission.get("type", "code")
        payload = submission.get("payload", submission)
        res = engine.evaluate(
            task_id=task_id,
            user_id=user_id,
            submission_type=sub_type,
            submission_payload=payload,
            target_role=submission.get("target_role", "Junior Backend Developer"),
            target_skill=submission.get("target_skill", "API Testing")
        )
        return {
            "total_score": res["total_score"],
            "max_score": res["max_score"],
            "passed": res["status"] == "passed",
            "scores_breakdown": {c["id"]: c["score"] for c in res["criteria"]},
            "criteria_feedback": [c["feedback"] for c in res["criteria"]],
            "new_skill_status": "Verified" if res["status"] == "passed" else "Needs Improvement"
        }

__all__ = ["RubricEvaluator", "SKILL_RUBRIC_SPECS", "GENERIC_FALLBACK_RUBRIC"]
