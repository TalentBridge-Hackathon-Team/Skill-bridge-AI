"""
SkillBridge AI — Job & Goal Analysis Views
Member 2 responsibility — Blueprint 2.0, Sections 4–6.

Endpoints implemented here:
  GET  /api/job-analyses/                          List analyses for a user
  POST /api/job-analyses/                          Create analysis + extract requirements
  GET  /api/job-analyses/{analysis_id}/            Retrieve a single analysis
  PATCH /api/job-analyses/{analysis_id}/requirements/  Human review & confirm
  GET  /api/goals/                                 List goals for a user
  POST /api/goals/                                 Create goal + map to profile

AI extraction fallback chain (configured in bedrock_service.py):
  1. Amazon Bedrock (Claude) — if real AWS credentials are present
  2. OpenRouter (Gemma) — if OPENROUTER_API_KEY is set
  3. Deterministic keyword rule engine — always available
"""

import uuid
import logging

from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
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
from services.bedrock_service import bedrock_extractor

logger = logging.getLogger(__name__)


def _generate_id(prefix: str) -> str:
    """Consistent ID generator used across the module."""
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# Job Analysis
# ---------------------------------------------------------------------------

class JobAnalysisListCreateView(APIView):
    """
    GET  /api/job-analyses/  — List all analyses for a user
    POST /api/job-analyses/  — Create + extract requirements (Mode A)
    """

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        user_id = str(request.user.id)
        analyses = JobAnalysis.objects.filter(user_id=user_id).order_by("-created_at")
        serializer = JobAnalysisSerializer(analyses, many=True)
        return Response(serializer.data)

    def post(self, request):
        # ── 1. Extract and validate raw inputs ──────────────────────────────
        raw_job_text = request.data.get("job_text", "")
        job_image = request.FILES.get("job_image")
        user_id = str(request.user.id)   # always use authenticated user's real ID
        raw_days = request.data.get("days_remaining", 14)
        raw_hours = request.data.get("study_hours_per_week", 14.0)

        # Must have at least one input source
        if not raw_job_text and not job_image:
            return Response(
                {
                    "error": (
                        "Please provide either job description text (job_text) "
                        "or an image/screenshot (job_image)."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate each field; ValidationError → 400 automatically via DRF
        try:
            if raw_job_text:
                job_text = validate_job_text(raw_job_text)
            else:
                job_text = "(Image screenshot provided — text extraction pending)"
            validate_job_image(job_image)
            days_remaining = validate_days_remaining(raw_days)
            study_hours = validate_study_hours(raw_hours)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        # ── 2. Run AI extraction (Bedrock → OpenRouter → Rule engine) ────────
        extraction_source = "rule_engine"
        extracted_data = {"role_title": "Junior Backend Developer", "summary": "", "requirements": []}

        try:
            extracted_data = bedrock_extractor.extract_job_requirements(job_text)
            extraction_source = extracted_data.get("extraction_source", "unknown")
            logger.info("Extraction completed via: %s", extraction_source)
        except Exception as exc:  # noqa: BLE001
            # The bedrock_extractor.extract_job_requirements() already handles
            # exceptions internally and never raises, but this is a safety net.
            logger.error("Unexpected extraction error: %s", exc)

        extracted_reqs = extracted_data.get("requirements", [])

        # If extraction returned nothing useful, fall back to defaults
        if not extracted_reqs:
            from services.bedrock_service import _rule_engine_extract  # noqa: PLC0415
            extracted_data = _rule_engine_extract(job_text)
            extracted_reqs = extracted_data["requirements"]
            extraction_source = "rule_engine"

        # ── 3. Persist to database ───────────────────────────────────────────
        role_title = (
            request.data.get("role_title")
            or extracted_data.get("role_title")
            or "Junior Backend Developer"
        )
        summary = (
            extracted_data.get("summary")
            or f"Extracted via {extraction_source}."
        )

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

        for req_item in extracted_reqs:
            Requirement.objects.create(
                requirement_id=_generate_id("req"),
                analysis=analysis,
                skill_name=req_item.get("skill_name", "Unknown Skill"),
                category=req_item.get("category", "concepts"),
                importance=req_item.get("importance", "required"),
                source_excerpt=req_item.get(
                    "source_excerpt", f"Extracted via {extraction_source}"
                ),
                user_confirmed=True,
            )

        serializer = JobAnalysisSerializer(analysis)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class JobAnalysisDetailView(APIView):
    """
    GET /api/job-analyses/{analysis_id}/ — Retrieve a single analysis with requirements
    """

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
    Human review step: user confirms, edits, removes, or adds requirements.
    The submitted list fully replaces the current set (user is in control).
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
                {"error": "Missing 'requirements' field in request body."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate each requirement item
        try:
            cleaned_reqs = validate_requirements_list(req_list)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        # Replace the full requirement set atomically
        analysis.requirements.all().delete()
        created = []
        for r in cleaned_reqs:
            req = Requirement.objects.create(
                requirement_id=r["requirement_id"] or _generate_id("req"),
                analysis=analysis,
                skill_name=r["skill_name"],
                category=r["category"],
                importance=r["importance"],
                source_excerpt=r["source_excerpt"],
                user_confirmed=True,
            )
            created.append(req)

        serializer = RequirementSerializer(created, many=True)
        return Response(
            {
                "message": "Requirements updated successfully.",
                "analysis_id": analysis_id,
                "requirements": serializer.data,
            }
        )


# ---------------------------------------------------------------------------
# Goals (Mode B)
# ---------------------------------------------------------------------------

class GoalListCreateView(APIView):
    """
    GET  /api/goals/ — List goals for a user
    POST /api/goals/ — Create a goal and map it to a skill profile (Mode B)
    """

    def get(self, request):
        user_id = str(request.user.id)
        goals = Goal.objects.filter(user_id=user_id).order_by("-created_at")
        serializer = GoalSerializer(goals, many=True)
        return Response(serializer.data)

    def post(self, request):
        # ── 1. Validate inputs ───────────────────────────────────────────────
        raw_goal_text = request.data.get("goal_text", "")
        raw_goal_type = request.data.get("goal_type", "career_role")
        user_id = str(request.user.id)   # always use authenticated user's real ID
        raw_days = request.data.get("days_remaining", 30)
        raw_hours = request.data.get("study_hours_per_week", 10.0)

        try:
            goal_text = validate_goal_text(raw_goal_text)
            goal_type = validate_goal_type(raw_goal_type)
            days_remaining = validate_days_remaining(raw_days)
            study_hours = validate_study_hours(raw_hours)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        # ── 2. Map goal to a supported skill profile ─────────────────────────
        mapping = map_goal_to_profile(goal_text)
        logger.info(
            "Goal mapped to profile '%s' with confidence '%s'. Keywords: %s",
            mapping.profile_id,
            mapping.confidence,
            mapping.matched_keywords,
        )

        # ── 3. Save the Goal to the database ────────────────────────────────
        goal = Goal.objects.create(
            goal_id=_generate_id("goal"),
            user_id=user_id,
            goal_type=goal_type,
            goal_text=goal_text,
            target_profile_id=mapping.profile_id,
            days_remaining=days_remaining,
            study_hours_per_week=study_hours,
        )

        # ── 4. Build the response ────────────────────────────────────────────
        # We return both the saved Goal and the profile requirements so the
        # frontend can immediately show the review list without a second request.
        response_data = {
            "goal": GoalSerializer(goal).data,
            "profile_id": mapping.profile_id,
            "role_title": mapping.role_title,
            "confidence": mapping.confidence,
            "warning": mapping.warning,
            "requirements": mapping.requirements,
        }

        return Response(response_data, status=status.HTTP_201_CREATED)
