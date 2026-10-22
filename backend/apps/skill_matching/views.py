from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.job_analysis.models import JobAnalysis
from apps.profiles.models import UserProfile
from services.matching_engine import SkillMatchingEngine
from .models import MatchReport
from .serializers import MatchReportSerializer

class JobAnalysisMatchView(APIView):
    """
    POST /api/job-analyses/{id}/match/
    Executes deterministic skill matching comparing requirements with learner profile evidence,
    and calculates deadline feasibility according to Blueprint 2.0 (Sections 7 & 8).
    """
    def post(self, request, analysis_id):
        try:
            analysis = JobAnalysis.objects.get(analysis_id=analysis_id)
        except JobAnalysis.DoesNotExist:
            return Response({"error": "Job analysis not found"}, status=status.HTTP_404_NOT_FOUND)

        # Retrieve profile for user
        profile = UserProfile.objects.filter(user_id=analysis.user_id).first()
        profile_data = {
            "skills": profile.skills if profile else ["Python", "Django REST Framework", "PostgreSQL", "Git"],
            "evidence": [
                {
                    "skill_name": e.skill_name,
                    "review_status": e.review_status,
                    "title": e.title,
                    "reference": e.reference
                }
                for e in (profile.evidence_records.all() if profile else [])
            ]
        }

        # Convert requirements
        requirements = [
            {
                "requirement_id": req.requirement_id,
                "skill_name": req.skill_name,
                "importance": req.importance,
                "category": req.category
            }
            for req in analysis.requirements.all()
        ]

        # Deterministic match
        match_results = SkillMatchingEngine.match(requirements, profile_data)

        # Save/update MatchReport objects
        for res in match_results:
            MatchReport.objects.update_or_create(
                report_id=f"rep_{res['requirement_id']}",
                defaults={
                    "analysis": analysis,
                    "skill_name": res["skill_name"],
                    "status": res["status"],
                    "priority": res["priority"],
                    "reason": res["reason"],
                    "recommended_action": res["recommended_action"]
                }
            )

        # Calculate deadline feasibility
        days = analysis.days_remaining
        daily_hours = round(analysis.study_hours_per_week / 7.0, 1) if analysis.study_hours_per_week else 2.0
        task_estimates = [r["effort_hours_estimate"] for r in match_results if r["status"] != "Demonstrated"]
        feasibility = SkillMatchingEngine.calculate_feasibility(days, daily_hours, task_estimates)

        reports = MatchReport.objects.filter(analysis=analysis)
        serializer = MatchReportSerializer(reports, many=True)

        return Response({
            "analysis_id": analysis_id,
            "role_title": analysis.role_title,
            "results": serializer.data,
            "feasibility": feasibility
        })

class JobAnalysisGapsView(APIView):
    """
    GET /api/job-analyses/{id}/gaps/
    Retrieves prioritized skill gap breakdown and feasibility.
    """
    def get(self, request, analysis_id):
        reports = MatchReport.objects.filter(analysis_id=analysis_id)
        serializer = MatchReportSerializer(reports, many=True)

        analysis = JobAnalysis.objects.filter(analysis_id=analysis_id).first()
        feasibility = None
        if analysis:
            days = analysis.days_remaining
            daily_hours = round(analysis.study_hours_per_week / 7.0, 1) if analysis.study_hours_per_week else 2.0
            task_estimates = [4.0 for _ in reports]
            feasibility = SkillMatchingEngine.calculate_feasibility(days, daily_hours, task_estimates)

        return Response({
            "analysis_id": analysis_id,
            "results": serializer.data,
            "feasibility": feasibility
        })
