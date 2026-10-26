"""
SkillBridge AI — Job & Goal Analysis Views
Member 2 responsibility.

Endpoints:
  GET  /api/job-analyses/                         List analyses for authenticated user
  POST /api/job-analyses/                         Create analysis + extract requirements (Mode A)
  GET  /api/job-analyses/{analysis_id}/           Retrieve single analysis with requirements
  PATCH /api/job-analyses/{analysis_id}/requirements/  Human review — confirm/edit/remove
  GET  /api/goals/                                List goals for authenticated user
  POST /api/goals/                                Create goal + map to profile (Mode B)
  GET  /api/profiles-list/                        List all supported skill profiles

AI extraction:
  Primary:  OpenRouter (google/gemma-4-26b-a4b-it:free)
  Fallback: Deterministic multi-role rule engine (always available)
"""

import uuid
import logging

from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .goal_mapper import map_goal_to_profile
from .models import Goal, JobAnalysis, Requirement
from .serializers import GoalSerializer, JobAnalysisSerializer, RequirementSerializer
from .validators import (
    validate_days_remaining,
    validate_goal_text,
    validate_goal_type,
    validate_job_image,
    validate_job_text,
    validate_requirements_list,
    validate_study_hours,
)
from services.openrouter_service import openrouter_service
from services.openrouter_service import _rule_engine_extract
from services.skill_profiles import list_profiles

logger = logging.getLogger(__name__)


def _generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _get_user_id(request) -> str:
    """
    Returns the user identifier for the current request.
    - Authenticated requests: use the real Django user PK (int → str).
    - Unauthenticated / test requests: fall back to 'user_id' in the body,
      then 'demo_user'. This keeps tests simple without requiring JWTs.
    """
    if request.user and request.user.is_authenticated:
        return str(request.user.id)
    return str(request.data.get("user_id") or
               request.query_params.get("user_id") or
               "demo_user")


# ---------------------------------------------------------------------------
# Supported Profiles (read-only, public)
# ---------------------------------------------------------------------------

class ProfilesListView(APIView):
    """
    GET /api/profiles-list/
    Returns all supported skill profiles (id, title, description).
    Used by the frontend to populate the profile picker in Mode B.
    Public — no auth required.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(list_profiles())


# ---------------------------------------------------------------------------
# Job Analysis (Mode A)
# ---------------------------------------------------------------------------

class JobAnalysisListCreateView(APIView):
    """
    GET  /api/job-analyses/   List all analyses for the authenticated user
    POST /api/job-analyses/   Create analysis + extract requirements
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        user_id = _get_user_id(request)
        analyses = JobAnalysis.objects.filter(user_id=user_id).order_by("-created_at")
        return Response(JobAnalysisSerializer(analyses, many=True).data)

    def post(self, request):
        # ── 1. Validate inputs ───────────────────────────────────────────────
        raw_job_text = request.data.get("job_text", "")
        job_image = request.FILES.get("job_image")
        user_id = _get_user_id(request)
        raw_days = request.data.get("days_remaining", 14)
        raw_hours = request.data.get("study_hours_per_week", 14.0)

        if not raw_job_text and not job_image:
            return Response(
                {"error": "Provide job description text (job_text) or an image (job_image)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            job_text = validate_job_text(raw_job_text) if raw_job_text else \
                       "(Image screenshot provided — text extraction pending)"
            validate_job_image(job_image)
            days_remaining = validate_days_remaining(raw_days)
            study_hours = validate_study_hours(raw_hours)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        # ── 2. Extract requirements (OpenRouter → rule engine) ───────────────
        try:
            extracted = openrouter_service.extract_job_requirements(job_text)
        except Exception as exc:
            logger.error("Extraction crashed unexpectedly: %s", exc)
            extracted = _rule_engine_extract(job_text)

        extracted_reqs = extracted.get("requirements", [])
        extraction_source = extracted.get("extraction_source", "rule_engine")

        # Safety net: if we still got nothing, force defaults
        if not extracted_reqs:
            extracted = _rule_engine_extract(job_text)
            extracted_reqs = extracted["requirements"]
            extraction_source = "rule_engine"

        # ── 3. Persist ───────────────────────────────────────────────────────
        role_title = (
            request.data.get("role_title") or
            extracted.get("role_title") or
            "Software Role"
        )
        summary = extracted.get("summary") or f"Extracted via {extraction_source}."

        analysis = JobAnalysis.objects.create(
            analysis_id=_generate_id("job"),
            user_id=user_id,
            mode="job_specific",
            role_title=role_title,
            job_text=job_text,
            job_image=job_image,
            days_remaining=days_remaining,
            study_hours_per_week=study_hours,
            summary=summary,
            status="completed",
        )

        for req in extracted_reqs:
            Requirement.objects.create(
                requirement_id=_generate_id("req"),
                analysis=analysis,
                skill_name=req.get("skill_name", "Unknown Skill"),
                category=req.get("category", "concepts"),
                importance=req.get("importance", "required"),
                source_excerpt=req.get("source_excerpt", f"Extracted via {extraction_source}"),
                user_confirmed=True,
            )

        logger.info("Job analysis %s created (%d reqs, source=%s)",
                    analysis.analysis_id, len(extracted_reqs), extraction_source)
        return Response(JobAnalysisSerializer(analysis).data, status=status.HTTP_201_CREATED)


class JobAnalysisDetailView(APIView):
    """GET /api/job-analyses/{analysis_id}/"""

    def get(self, request, analysis_id):
        try:
            analysis = JobAnalysis.objects.get(analysis_id=analysis_id)
        except JobAnalysis.DoesNotExist:
            return Response(
                {"error": f"Job analysis '{analysis_id}' not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(JobAnalysisSerializer(analysis).data)


class JobAnalysisRequirementsUpdateView(APIView):
    """
    PATCH /api/job-analyses/{analysis_id}/requirements/
    Human review: full-replace the requirement set with the user's confirmed list.
    """

    def patch(self, request, analysis_id):
        try:
            analysis = JobAnalysis.objects.get(analysis_id=analysis_id)
        except JobAnalysis.DoesNotExist:
            return Response(
                {"error": f"Job analysis '{analysis_id}' not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        req_list = request.data.get("requirements")
        if req_list is None:
            return Response(
                {"error": "Missing 'requirements' key in request body."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            cleaned = validate_requirements_list(req_list)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        # Atomic full-replace
        analysis.requirements.all().delete()
        created = []
        for r in cleaned:
            obj = Requirement.objects.create(
                requirement_id=r["requirement_id"] or _generate_id("req"),
                analysis=analysis,
                skill_name=r["skill_name"],
                category=r["category"],
                importance=r["importance"],
                source_excerpt=r["source_excerpt"],
                user_confirmed=True,
            )
            created.append(obj)

        return Response({
            "message": "Requirements updated successfully.",
            "analysis_id": analysis_id,
            "requirements": RequirementSerializer(created, many=True).data,
        })


# ---------------------------------------------------------------------------
# Goals (Mode B)
# ---------------------------------------------------------------------------

class GoalListCreateView(APIView):
    """
    GET  /api/goals/   List goals for the authenticated user
    POST /api/goals/   Create goal + map to best-matching skill profile
    """

    def get(self, request):
        user_id = _get_user_id(request)
        goals = Goal.objects.filter(user_id=user_id).order_by("-created_at")
        return Response(GoalSerializer(goals, many=True).data)

    def post(self, request):
        # ── 1. Validate ──────────────────────────────────────────────────────
        raw_goal_text = request.data.get("goal_text", "")
        raw_goal_type = request.data.get("goal_type", "career_role")
        user_id = _get_user_id(request)
        raw_days = request.data.get("days_remaining", 30)
        raw_hours = request.data.get("study_hours_per_week", 10.0)

        try:
            goal_text = validate_goal_text(raw_goal_text)
            goal_type = validate_goal_type(raw_goal_type)
            days_remaining = validate_days_remaining(raw_days)
            study_hours = validate_study_hours(raw_hours)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        # ── 2. Map to best-matching profile ──────────────────────────────────
        mapping = map_goal_to_profile(goal_text)
        logger.info("Goal mapped → '%s' (confidence=%s, keywords=%s)",
                    mapping.profile_id, mapping.confidence, mapping.matched_keywords)

        # ── 3. Persist ───────────────────────────────────────────────────────
        goal = Goal.objects.create(
            goal_id=_generate_id("goal"),
            user_id=user_id,
            goal_type=goal_type,
            goal_text=goal_text,
            target_profile_id=mapping.profile_id,
            days_remaining=days_remaining,
            study_hours_per_week=study_hours,
        )

        # ── 4. Response includes requirements so frontend shows them immediately
        return Response({
            "goal": GoalSerializer(goal).data,
            "profile_id": mapping.profile_id,
            "role_title": mapping.role_title,
            "confidence": mapping.confidence,
            "warning": mapping.warning,
            "requirements": mapping.requirements,
        }, status=status.HTTP_201_CREATED)
