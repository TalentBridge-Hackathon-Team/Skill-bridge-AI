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
    Executes deterministic and vector similarity skill matching comparing requirements with learner profile evidence,
    and calculates deadline feasibility according to Blueprint 2.0 (Sections 7 & 8).
    """
    def post(self, request, analysis_id):
        # 1. Resolve analysis by exact ID or role title in Neon database
        analysis = JobAnalysis.objects.filter(analysis_id=analysis_id).first()
        if not analysis:
            clean_title = analysis_id.replace('role_', '').replace('_', ' ').strip()
            analysis = JobAnalysis.objects.filter(role_title__icontains=clean_title).first()
        if not analysis:
            analysis = JobAnalysis.objects.first()

        if not analysis:
            return Response({"error": "Job analysis not found in database"}, status=status.HTTP_404_NOT_FOUND)

        # 2. Allow user_id override from query param or body, defaulting to analysis.user_id
        user_id = (
            request.query_params.get("user_id")
            or (request.data.get("user_id") if isinstance(request.data, dict) else None)
            or analysis.user_id
        )

        # Retrieve profile for user from Neon database
        profile = (
            UserProfile.objects.filter(user_id=user_id).first()
            or UserProfile.objects.filter(user_id=analysis.user_id).first()
            or UserProfile.objects.filter(user_id="usr_demo_001").first()
            or UserProfile.objects.filter(user_id="demo_user").first()
            or UserProfile.objects.first()
        )

        if not profile:
            return Response(
                {"error": f"Learner profile for user_id '{user_id}' not found in database"},
                status=status.HTTP_404_NOT_FOUND
            )

        profile_data = {
            "skills": profile.skills,
            "evidence": [
                {
                    "evidence_id": e.evidence_id,
                    "skill_name": e.skill_name,
                    "review_status": e.review_status,
                    "status": e.review_status,
                    "title": e.title,
                    "reference": e.reference,
                    "evidence_type": e.evidence_type,
                    "description": e.description,
                    "embedding": e.embedding
                }
                for e in profile.evidence_records.all()
            ]
        }

        # Query completed assessments from Member 4's app (if available)
        completed_assessments = []
        try:
            from apps.assessments.models import AssessmentSubmission
            submissions = AssessmentSubmission.objects.filter(user_id=user_id)
            for sub in submissions:
                completed_assessments.append({
                    "target_skill": sub.task.target_skill,
                    "score": sub.score,
                    "status": sub.status
                })
        except Exception:
            pass

        # Convert requirements
        requirements = [
            {
                "requirement_id": req.requirement_id,
                "skill_name": req.skill_name,
                "importance": req.importance,
                "category": req.category,
                "source_excerpt": req.source_excerpt
            }
            for req in analysis.requirements.all()
        ]

        # Execute deterministic & vector matching
        match_results = SkillMatchingEngine.match(
            requirements=requirements,
            profile=profile_data,
            completed_assessments=completed_assessments
        )

        # Save/update MatchReport objects
        for res in match_results:
            req_obj = analysis.requirements.filter(
                requirement_id=res["requirement_id"]
            ).first()

            MatchReport.objects.update_or_create(
                report_id=f"rep_{res['requirement_id']}",
                defaults={
                    "analysis": analysis,
                    "requirement": req_obj,
                    "skill_name": res["skill_name"],
                    "category": res.get("category", "concepts"),
                    "importance": res.get("importance", "required"),
                    "status": res["status"],
                    "priority": res["priority"],
                    "reason": res["reason"],
                    "recommended_action": res["recommended_action"],
                    "effort_hours_estimate": res.get("effort_hours_estimate", 0.0),
                    "effort_breakdown": res.get("effort_breakdown", {}),
                    "similarity_score": res.get("similarity_score"),
                    "supporting_evidence_ids": res.get("supporting_evidence_ids", [])
                }
            )

        # Calculate deadline feasibility
        days = analysis.days_remaining
        daily_hours = round(analysis.study_hours_per_week / 7.0, 1) if analysis.study_hours_per_week else 2.0
        task_estimates = [r["effort_hours_estimate"] for r in match_results if r["status"] != "Demonstrated"]
        feasibility = SkillMatchingEngine.calculate_feasibility(days, daily_hours, task_estimates)

        # Calculate summary metrics & match score
        summary = SkillMatchingEngine.calculate_match_summary(match_results)

        reports = MatchReport.objects.filter(analysis=analysis)
        serializer = MatchReportSerializer(reports, many=True)

        return Response({
            "analysis_id": analysis_id,
            "role_title": analysis.role_title,
            "summary": summary,
            "results": serializer.data,
            "feasibility": feasibility
        })

class JobAnalysisGapsView(APIView):
    """
    GET /api/job-analyses/{id}/gaps/
    Retrieves prioritized skill gap breakdown, summary, and feasibility.
    """
    def get(self, request, analysis_id):
        analysis = JobAnalysis.objects.filter(analysis_id=analysis_id).first()
        if not analysis:
            clean_title = analysis_id.replace('role_', '').replace('_', ' ').strip()
            analysis = JobAnalysis.objects.filter(role_title__icontains=clean_title).first()
        if not analysis:
            analysis = JobAnalysis.objects.first()

        if not analysis:
            return Response({"error": "Job analysis not found in database"}, status=status.HTTP_404_NOT_FOUND)

        reports = MatchReport.objects.filter(analysis=analysis)
        serializer = MatchReportSerializer(reports, many=True)

        days = analysis.days_remaining
        daily_hours = round(analysis.study_hours_per_week / 7.0, 1) if analysis.study_hours_per_week else 2.0
        task_estimates = [r.effort_hours_estimate for r in reports if r.status != 'Demonstrated']
        feasibility = SkillMatchingEngine.calculate_feasibility(days, daily_hours, task_estimates)

        match_data = [
            {
                "status": r.status,
                "importance": r.importance,
                "effort_hours_estimate": r.effort_hours_estimate
            }
            for r in reports
        ]
        summary = SkillMatchingEngine.calculate_match_summary(match_data)

        return Response({
            "analysis_id": analysis_id,
            "summary": summary,
            "results": serializer.data,
            "feasibility": feasibility
        })
