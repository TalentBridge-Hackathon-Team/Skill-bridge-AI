import uuid
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import JobAnalysis, Requirement, Goal
from .serializers import JobAnalysisSerializer, RequirementSerializer, GoalSerializer
from services.openrouter_service import openrouter_service
from services.domain_guard_service import domain_guard

class JobAnalysisListCreateView(APIView):
    """
    POST /api/job-analyses/ - Create job analysis & trigger extraction
    Supports Mode A (job-specific & deadline-aware) with raw text/screenshot,
    closing deadline, and weekly study capacity.
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        user_id = request.query_params.get("user_id")
        if user_id:
            analyses = JobAnalysis.objects.filter(user_id=user_id).order_by('-created_at')
        else:
            analyses = JobAnalysis.objects.filter(user_id__in=["usr_demo_001", "demo_user"]).order_by('-created_at')
        serializer = JobAnalysisSerializer(analyses, many=True)
        return Response(serializer.data)

    def post(self, request):
        job_text = request.data.get("job_text", "").strip()
        job_image = request.FILES.get("job_image")
        user_id = request.data.get("user_id", "demo_user")
        days_remaining = int(request.data.get("days_remaining", 14))
        study_hours_per_week = float(request.data.get("study_hours_per_week", 14.0))

        if not job_text and not job_image:
            return Response(
                {"error": "Please provide either job description text or an image/screenshot."},
                status=status.HTTP_400_BAD_REQUEST
            )

        role_title = request.data.get("role_title") or request.data.get("title") or "Junior Backend Developer"
        mode = request.data.get("mode", "job_specific")

        # Evaluate safety & domain support
        safety_check = domain_guard.evaluate_input_safety_and_domain(job_text, role_title)
        if not safety_check["is_safe"]:
            return Response(
                {
                    "error": safety_check["error_type"],
                    "message": safety_check["message"]
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not safety_check["is_tech_domain"]:
            return Response(
                {
                    "error": "domain_in_development",
                    "status": "domain_in_development",
                    "detected_domain": safety_check.get("detected_domain", "Non-Technical"),
                    "message": safety_check["message"],
                    "suggested_tech_roles": safety_check.get("suggested_tech_roles", [])
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        # Extract requirements using OpenRouter LLM (with deterministic rule engine validation)
        extraction_data = openrouter_service.extract_job_requirements(job_text or "(Screenshot provided)", role_title=role_title)
        extracted_reqs = extraction_data.get("requirements", [])
        final_role_title = extraction_data.get("role_title", role_title)
        summary = extraction_data.get("summary", f"Extracted requirements for {final_role_title}.")

        analysis_id = f"job_{uuid.uuid4().hex[:8]}"
        analysis = JobAnalysis.objects.create(
            analysis_id=analysis_id,
            user_id=user_id,
            mode=mode,
            role_title=final_role_title,
            job_text=job_text or "(Image screenshot provided for extraction)",
            job_image=job_image,
            days_remaining=days_remaining,
            study_hours_per_week=study_hours_per_week,
            summary=summary,
            status="completed"
        )

        for req_item in extracted_reqs:
            Requirement.objects.create(
                requirement_id=f"req_{uuid.uuid4().hex[:6]}",
                analysis=analysis,
                skill_name=req_item.get("skill_name", "Skill"),
                category=req_item.get("category", "framework"),
                importance=req_item.get("importance", "required"),
                source_excerpt=req_item.get("source_excerpt", "Extracted via OpenRouter"),
                user_confirmed=True
            )

        serializer = JobAnalysisSerializer(analysis)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class JobAnalysisDetailView(APIView):
    """
    GET /api/job-analyses/{id}/ - Retrieve job analysis details
    """
    def get(self, request, analysis_id):
        try:
            analysis = JobAnalysis.objects.get(analysis_id=analysis_id)
        except JobAnalysis.DoesNotExist:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(JobAnalysisSerializer(analysis).data)

class JobAnalysisRequirementsUpdateView(APIView):
    """
    PATCH /api/job-analyses/{id}/requirements/ - Edit or confirm requirements
    """
    def patch(self, request, analysis_id):
        try:
            analysis = JobAnalysis.objects.get(analysis_id=analysis_id)
        except JobAnalysis.DoesNotExist:
            return Response({"error": "Job analysis not found"}, status=status.HTTP_404_NOT_FOUND)

        req_list = request.data.get("requirements", [])
        if isinstance(req_list, list):
            analysis.requirements.all().delete()
            for r in req_list:
                Requirement.objects.create(
                    requirement_id=r.get("requirement_id") or r.get("id") or f"req_{uuid.uuid4().hex[:6]}",
                    analysis=analysis,
                    skill_name=r.get("skill_name"),
                    category=r.get("category", "framework"),
                    importance=r.get("importance", "required"),
                    source_excerpt=r.get("source_excerpt", "User updated"),
                    user_confirmed=True
                )
        return Response({
            "message": "Requirements updated",
            "analysis_id": analysis_id,
            "analysis": JobAnalysisSerializer(analysis).data
        })

class GoalListCreateView(APIView):
    """
    POST /api/goals/ - Blueprint 2.0 Mode B Goal Setup
    Maps a career role or skill goal into the supported Junior Backend Developer profile.
    """
    def get(self, request):
        user_id = request.query_params.get("user_id", "demo_user")
        goals = Goal.objects.filter(user_id=user_id)
        serializer = GoalSerializer(goals, many=True)
        return Response(serializer.data)

    def post(self, request):
        goal_text = request.data.get("goal_text", "").strip()
        goal_type = request.data.get("goal_type", "career_role")
        user_id = request.data.get("user_id", "demo_user")
        days = request.data.get("days_remaining", 30)
        study_hours = request.data.get("study_hours_per_week", 10.0)

        if not goal_text:
            return Response({"error": "Please provide a goal description."}, status=status.HTTP_400_BAD_REQUEST)

        goal_id = f"goal_{uuid.uuid4().hex[:8]}"
        goal = Goal.objects.create(
            goal_id=goal_id,
            user_id=user_id,
            goal_type=goal_type,
            goal_text=goal_text,
            target_profile_id="prof_junior_backend",
            days_remaining=days,
            study_hours_per_week=study_hours
        )

        serializer = GoalSerializer(goal)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
