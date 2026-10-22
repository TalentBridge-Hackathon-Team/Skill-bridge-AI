"""
Skill-Gap Matching & Feasibility Engine
Blueprint 2.0 (Sections 7 & 8)
Member 3 & 4 responsibility: Deterministic requirement-to-evidence matching & deadline feasibility.
"""

from typing import List, Dict, Any, Optional

class SkillMatchingEngine:
    """Service for deterministic requirement matching and deadline feasibility calculations."""

    @staticmethod
    def match(
        requirements: List[Dict[str, Any]],
        profile: Dict[str, Any],
        completed_assessments: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Compare target requirements against profile evidence records and self-reported skills.
        Statuses (Section 7):
        - Demonstrated: Relevant project or assessment provides evidence at the stated level.
        - Self-reported: Learner claims the skill, but supporting project evidence not verified.
        - Unverified: Insufficient information to determine ability.
        - Needs improvement: Assessment or reviewed evidence shows criteria not yet met.
        """
        evidence_records = profile.get("evidence", []) or profile.get("evidence_records", [])
        self_reported_skills = profile.get("skills", [])
        if isinstance(self_reported_skills, str):
            self_reported_skills = [s.strip().lower() for s in self_reported_skills.split(",")]
        else:
            self_reported_skills = [s.lower() for s in self_reported_skills]

        assessments = completed_assessments or []
        verified_evidence_names = {
            e.get("skill_name", "").lower()
            for e in evidence_records
            if e.get("review_status") == "verified" or e.get("status") == "verified"
        }

        results = []
        for req in requirements:
            skill = req.get("skill_name", "")
            skill_lower = skill.lower()
            importance = req.get("importance", "required")

            # Check assessment completion first
            assessment_match = next((a for a in assessments if a.get("target_skill", "").lower() == skill_lower), None)

            if assessment_match:
                score = assessment_match.get("score", 0)
                if score >= 8:
                    status = "Demonstrated"
                    priority = "Low"
                    reason = f"Verified by controlled assessment score of {score}/10."
                    action = "Ready to showcase in technical interviews."
                    effort = 0
                else:
                    status = "Needs improvement"
                    priority = "High" if importance == "required" else "Medium"
                    reason = f"Assessment score of {score}/10 indicates criteria need reinforcement."
                    action = "Review assessment feedback and resubmit test cases."
                    effort = 4
            elif any(skill_lower in ev for ev in verified_evidence_names) or any(ev in skill_lower for ev in verified_evidence_names):
                status = "Demonstrated"
                priority = "Low"
                reason = "Verified project evidence repository found in learner profile."
                action = "Ready to showcase in technical interview questions and portfolio."
                effort = 0
            elif any(skill_lower in s for s in self_reported_skills) or any(s in skill_lower for s in self_reported_skills):
                status = "Self-reported"
                priority = "High" if importance == "required" else "Medium"
                reason = "Listed in profile skills, but no verified project repository or assessment linked."
                action = "Link a project repository featuring implementation code and tests."
                effort = 8
            else:
                status = "Unverified"
                priority = "High" if importance == "required" else "Medium"
                reason = "Required role capability with no supporting project evidence or assessment."
                action = "Complete practical task and rubric assessment."
                effort = 6

            results.append({
                "requirement_id": req.get("requirement_id") or req.get("id"),
                "skill_name": skill,
                "status": status,
                "priority": priority,
                "reason": reason,
                "recommended_action": action,
                "effort_hours_estimate": effort,
                "importance": importance
            })

        return results

    @staticmethod
    def calculate_feasibility(
        days_remaining: Optional[int],
        study_hours_per_day: Optional[float],
        task_estimates: List[float],
        application_prep_hours: float = 4.0
    ) -> Dict[str, Any]:
        """
        Blueprint 2.0 Section 7: Deadline Feasibility Calculation
        Available hours = days remaining * planned study hours per day
        Estimated plan effort = sum of hours for selected tasks + application-preparation time.
        """
        if not days_remaining or days_remaining <= 0 or not study_hours_per_day or study_hours_per_day <= 0:
            return {
                "available_hours": 0,
                "estimated_plan_effort_hours": sum(task_estimates) + application_prep_hours,
                "days_remaining": days_remaining or 0,
                "study_hours_per_day": study_hours_per_day or 0,
                "feasibility_band": "Insufficient information",
                "interpretation": "Missing deadline or daily study capacity prevents a useful comparison.",
                "assumptions": ["Please provide days remaining and planned daily study hours."],
                "suggested_scope": "Define deadline and study capacity to evaluate feasibility."
            }

        available_hours = round(days_remaining * study_hours_per_day, 1)
        plan_effort = round(sum(task_estimates) + application_prep_hours, 1)

        # Ratio evaluation
        ratio = plan_effort / available_hours if available_hours > 0 else 999.0

        if ratio <= 0.85:
            band = "Likely feasible"
            interpretation = f"Estimated prioritized effort ({plan_effort} hrs) is comfortably below available study capacity ({available_hours} hrs)."
            suggested_scope = "Focus on completing High-priority deliverables and maintaining steady study pace."
        elif ratio <= 1.15:
            band = "Tight / uncertain"
            interpretation = f"Estimated effort ({plan_effort} hrs) is close to available time ({available_hours} hrs). Risks may arise if unexpected blockers occur."
            suggested_scope = "Reduce scope to the top 2 highest-value gaps; defer secondary tasks."
        else:
            band = "Not feasible as scoped"
            interpretation = f"Estimated effort ({plan_effort} hrs) exceeds available time ({available_hours} hrs)."
            suggested_scope = "Narrow scope to critical must-have gaps only; consider applying with transparent existing evidence."

        return {
            "available_hours": available_hours,
            "estimated_plan_effort_hours": plan_effort,
            "days_remaining": days_remaining,
            "study_hours_per_day": study_hours_per_day,
            "feasibility_band": band,
            "interpretation": interpretation,
            "assumptions": [
                f"{days_remaining} days remaining before application closing date",
                f"Assumes {study_hours_per_day} hours/day sustained study commitment",
                f"Includes {application_prep_hours} hours for application review and CV tailoring"
            ],
            "suggested_scope": suggested_scope
        }
