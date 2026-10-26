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
            user_candidates = list(filter(None, {user_id, "usr_demo_001", "demo_user", getattr(analysis, "user_id", None)}))
            submissions = AssessmentSubmission.objects.filter(user_id__in=user_candidates).order_by("-score", "-submitted_at")
            for sub in submissions:
                skill_val = (
                    (sub.task.target_skill if sub.task else None)
                    or (sub.submission_data.get("target_skill") if isinstance(sub.submission_data, dict) else None)
                    or (sub.submission_data.get("payload", {}).get("target_skill") if isinstance(sub.submission_data, dict) else None)
                    or ""
                )
                if skill_val:
                    completed_assessments.append({
                        "target_skill": skill_val,
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

        # Parse timeline & study commitment overrides from request query or body
        req_days = (
            request.query_params.get("days_remaining")
            or (request.data.get("days_remaining") if isinstance(request.data, dict) else None)
        )
        req_hours = (
            request.query_params.get("study_hours_per_week")
            or (request.data.get("study_hours_per_week") if isinstance(request.data, dict) else None)
        )

        try:
            days_remaining = int(req_days) if req_days is not None else analysis.days_remaining
        except (ValueError, TypeError):
            days_remaining = analysis.days_remaining

        try:
            study_hours_per_week = float(req_hours) if req_hours is not None else (analysis.study_hours_per_week or 14.0)
        except (ValueError, TypeError):
            study_hours_per_week = analysis.study_hours_per_week or 14.0

        study_hours_per_day = round(study_hours_per_week / 7.0, 2)

        # Update persisted analysis model if custom values provided
        if req_days is not None or req_hours is not None:
            analysis.days_remaining = days_remaining
            analysis.study_hours_per_week = int(study_hours_per_week)
            analysis.save(update_fields=["days_remaining", "study_hours_per_week"])

        # Execute deterministic & vector matching with deadline calibration
        match_results = SkillMatchingEngine.match(
            requirements=requirements,
            profile=profile_data,
            completed_assessments=completed_assessments,
            days_remaining=days_remaining,
            study_hours_per_day=study_hours_per_day
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

        # Prune obsolete MatchReports that are no longer in current requirements
        current_report_ids = [f"rep_{res['requirement_id']}" for res in match_results]
        analysis.match_reports.exclude(report_id__in=current_report_ids).delete()

        # Calculate deadline feasibility using the updated timeframe & capacity with sprint scoping
        unmet_items = [r for r in match_results if r["status"] != "Demonstrated"]
        feasibility = SkillMatchingEngine.calculate_sprint_feasibility(
            days_remaining=days_remaining,
            study_hours_per_day=study_hours_per_day,
            unmet_items=unmet_items
        )

        # Calculate summary metrics & match score
        summary = SkillMatchingEngine.calculate_match_summary(match_results)

        reports = MatchReport.objects.filter(analysis=analysis)
        serializer = MatchReportSerializer(
            reports,
            many=True,
            context={"deferred_skills": feasibility.get("deferred_skills", [])}
        )

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

        req_days = request.query_params.get("days_remaining")
        req_hours = request.query_params.get("study_hours_per_week")
        try:
            days = int(req_days) if req_days is not None else analysis.days_remaining
        except (ValueError, TypeError):
            days = analysis.days_remaining

        try:
            study_hours = float(req_hours) if req_hours is not None else (analysis.study_hours_per_week or 14.0)
        except (ValueError, TypeError):
            study_hours = analysis.study_hours_per_week or 14.0

        daily_hours = round(study_hours / 7.0, 1)

        unmet_reports = [
            {
                "skill_name": r.skill_name,
                "status": r.status,
                "priority": r.priority,
                "importance": r.importance,
                "effort_hours_estimate": r.effort_hours_estimate
            }
            for r in reports if r.status != 'Demonstrated'
        ]

        feasibility = SkillMatchingEngine.calculate_sprint_feasibility(
            days_remaining=days,
            study_hours_per_day=daily_hours,
            unmet_items=unmet_reports
        )

        match_data = [
            {
                "status": r.status,
                "importance": r.importance,
                "effort_hours_estimate": r.effort_hours_estimate
            }
            for r in reports
        ]
        summary = SkillMatchingEngine.calculate_match_summary(match_data)

        serializer = MatchReportSerializer(
            reports,
            many=True,
            context={"deferred_skills": feasibility.get("deferred_skills", [])}
        )

        return Response({
            "analysis_id": analysis_id,
            "summary": summary,
            "results": serializer.data,
            "feasibility": feasibility
        })


class EvidenceInspectView(APIView):
    """
    POST /api/skill-matching/inspect-evidence/
    AI-driven automated repository and code evidence inspection.
    Inspects GitHub repository with GITHUB_TOKEN and passes structure
    to OpenRouter AI for verification scoring, test detection, and audit findings.
    """
    def post(self, request):
        data = request.data or {}
        repo_url = data.get("repository_url") or data.get("reference") or ""
        skill_name = data.get("skill_name") or ""
        title = data.get("title") or ""
        description = data.get("description") or ""

        if not repo_url or not skill_name:
            return Response(
                {"error": "Both 'repository_url' and 'skill_name' are required for evidence inspection."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from services.evidence_inspector_service import evidence_inspector
        result = evidence_inspector.inspect_evidence(
            repository_url=repo_url,
            skill_name=skill_name,
            title=title,
            description=description
        )

        return Response(result, status=status.HTTP_200_OK)


class RemediationAdviceView(APIView):
    """
    POST /api/skill-matching/remediation-advice/
    AI Contextual Remediation Advisor.
    Generates level-calibrated technical interview questions and 3 progressive project tracks
    tailored to the learner's experience level, target role, and time budget.
    """
    def post(self, request):
        data = request.data or {}
        skill_name = data.get("skill_name") or ""
        category = data.get("category") or "general"
        importance = data.get("importance") or "required"
        remediation_hours = float(data.get("remediation_hours") or data.get("effort_hours_estimate") or 8.0)
        effort_breakdown = data.get("effort_breakdown") or {}
        user_id = data.get("user_id") or "usr_demo_001"
        experience_level = data.get("experience_level")
        role_title = data.get("role_title")

        if not skill_name:
            return Response(
                {"error": "'skill_name' is required for remediation advice."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Retrieve profile context if not provided in payload
        from apps.profiles.models import UserProfile
        profile = UserProfile.objects.filter(user_id=user_id).first()
        if profile:
            if not experience_level:
                experience_level = profile.experience_level or "Entry Level"
            if not role_title:
                role_title = profile.target_role or "Software Developer"
        else:
            experience_level = experience_level or "Entry Level"
            role_title = role_title or "Software Developer"

        skill_status = data.get("status") or data.get("skill_status") or "Unverified"
        try:
            days_remaining = int(data.get("days_remaining") or 14)
        except (ValueError, TypeError):
            days_remaining = 14
        feasibility_status = data.get("feasibility_status") or "moderate"

        from services.evidence_inspector_service import evidence_inspector
        advice = evidence_inspector.generate_remediation_advice(
            skill_name=skill_name,
            category=category,
            importance=importance,
            remediation_hours=remediation_hours,
            effort_breakdown=effort_breakdown,
            experience_level=experience_level,
            role_title=role_title,
            skill_status=skill_status,
            days_remaining=days_remaining,
            feasibility_status=feasibility_status
        )

        return Response(advice, status=status.HTTP_200_OK)

