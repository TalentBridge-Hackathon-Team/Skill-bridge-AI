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
from services.domain_guard_service import domain_guard
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
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        query_user = request.query_params.get("user_id")
        auth_user = str(request.user.id) if (getattr(request, "user", None) and request.user.is_authenticated) else None

        target_user = query_user or auth_user
        if not target_user or target_user in ("usr_demo_001", "demo_user"):
            candidates = ["usr_demo_001", "demo_user"]
        else:
            candidates = [str(target_user)]
            if auth_user:
                candidates.extend([str(auth_user), getattr(request.user, "username", "")])

        analyses = JobAnalysis.objects.filter(user_id__in=list(set(filter(None, candidates)))).prefetch_related('requirements').order_by('-created_at')
        serializer = JobAnalysisSerializer(analyses, many=True)
        return Response(serializer.data)

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

        role_title = request.data.get("role_title") or request.data.get("title")
        if not role_title and raw_job_text:
            from services.openrouter_service import _extract_role_title
            role_title = _extract_role_title(raw_job_text)
        if not role_title:
            role_title = "Software Engineer"
        mode = request.data.get("mode", "job_specific")

        try:
            job_text = validate_job_text(raw_job_text, has_image=bool(job_image)) if raw_job_text else ""
            validate_job_image(job_image)
            days_remaining = validate_days_remaining(raw_days)
            study_hours = validate_study_hours(raw_hours)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        # Multimodal OCR screenshot extraction if an image was uploaded
        if job_image:
            try:
                from services.rag_multimodal_service import RAGMultimodalService
                multimodal_service = RAGMultimodalService()
                extracted_image_text = multimodal_service.extract_text_from_job_image(job_image)
                if extracted_image_text and extracted_image_text.strip():
                    if job_text:
                        job_text = f"Target Role / Context: {job_text}\n\nJob Posting Content from Screenshot:\n{extracted_image_text.strip()}"
                    else:
                        job_text = extracted_image_text.strip()
            except Exception as img_err:
                logger.warning(f"Failed to extract image text: {img_err}")
                if not job_text:
                    job_text = "(Job screenshot provided for requirement extraction)"

        if not job_text:
            job_text = f"Target Role: {role_title}"

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

        # ── 2. Extract requirements (OpenRouter → rule engine) ───────────────
        try:
            extracted = openrouter_service.extract_job_requirements(job_text, role_title=role_title)
        except Exception as exc:
            logger.error("Extraction crashed unexpectedly: %s", exc)
            extracted = _rule_engine_extract(job_text)

        extracted_reqs = extracted.get("requirements", [])
        extraction_source = extracted.get("extraction_source", "rule_engine")
        final_role_title = extracted.get("role_title", role_title)
        summary = extracted.get("summary") or f"Extracted via {extraction_source}."

        # Safety net: if we still got nothing, force defaults
        if not extracted_reqs:
            extracted = _rule_engine_extract(job_text)
            extracted_reqs = extracted["requirements"]
            extraction_source = "rule_engine"

        # ── 3. Persist ───────────────────────────────────────────────────────
        analysis = JobAnalysis.objects.create(
            analysis_id=_generate_id("job"),
            user_id=user_id,
            mode=mode,
            role_title=final_role_title,
            job_text=job_text or "(Image screenshot provided for extraction)",
            job_image=job_image,
            days_remaining=days_remaining,
            study_hours_per_week=study_hours,
            summary=summary,
            status="completed"
        )

        # Upload job screenshot to configured Amazon S3 cloud storage
        if job_image:
            try:
                from services.aws_service import resume_pipeline
                job_image.seek(0)
                s3_res = resume_pipeline.upload_resume(
                    file_source=job_image.read(),
                    user_id=user_id,
                    filename=getattr(job_image, "name", f"job_screenshot_{analysis.analysis_id}.png"),
                    content_type=getattr(job_image, "content_type", "image/png")
                )
                job_image.seek(0)
                if s3_res.get("success"):
                    logger.info("Uploaded job screenshot to Amazon S3: %s", s3_res.get("s3_url"))
            except Exception as s3_err:
                logger.warning("Optional Amazon S3 screenshot upload: %s", s3_err)

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
    permission_classes = [AllowAny]

    def get(self, request, analysis_id):
        try:
            analysis = JobAnalysis.objects.prefetch_related('requirements').get(analysis_id=analysis_id)
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
    permission_classes = [AllowAny]

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
                requirement_id=r.get("requirement_id") or r.get("id") or _generate_id("req"),
                analysis=analysis,
                skill_name=r["skill_name"],
                category=r.get("category", "framework"),
                importance=r.get("importance", "required"),
                source_excerpt=r.get("source_excerpt", "User updated"),
                user_confirmed=True,
            )
            created.append(obj)

        return Response({
            "message": "Requirements updated successfully.",
            "analysis_id": analysis_id,
            "requirements": RequirementSerializer(created, many=True).data,
            "analysis": JobAnalysisSerializer(analysis).data
        })


# ---------------------------------------------------------------------------
# Goals (Mode B)
# ---------------------------------------------------------------------------

class GoalListCreateView(APIView):
    """
    GET  /api/goals/   List goals for the authenticated user
    POST /api/goals/   Create goal + map to best-matching skill profile
    """
    permission_classes = [AllowAny]

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

        # ── 3. Persist Goal & JobAnalysis for Mode B ─────────────────────────
        goal = Goal.objects.create(
            goal_id=_generate_id("goal"),
            user_id=user_id,
            goal_type=goal_type,
            goal_text=goal_text,
            target_profile_id=mapping.profile_id,
            days_remaining=days_remaining,
            study_hours_per_week=study_hours,
        )

        analysis = JobAnalysis.objects.create(
            analysis_id=_generate_id("analysis"),
            user_id=user_id,
            mode="goal_based",
            role_title=mapping.role_title,
            job_text=goal_text,
            days_remaining=days_remaining,
            study_hours_per_week=study_hours,
            summary=f"Career Goal: {goal_text} ({mapping.role_title})",
            status="completed"
        )

        created_reqs = []
        for req_data in mapping.requirements:
            r = Requirement.objects.create(
                requirement_id=_generate_id("req"),
                analysis=analysis,
                skill_name=req_data["skill_name"],
                category=req_data.get("category", "concepts"),
                importance=req_data.get("importance", "required"),
                source_excerpt=req_data.get("source_excerpt", f"Required for {mapping.role_title}"),
                user_confirmed=True
            )
            created_reqs.append(r)

        # ── 4. Response includes requirements so frontend shows them immediately
        return Response({
            "goal": GoalSerializer(goal).data,
            "analysis_id": analysis.analysis_id,
            "analysis": JobAnalysisSerializer(analysis).data,
            "profile_id": mapping.profile_id,
            "role_title": mapping.role_title,
            "confidence": mapping.confidence,
            "warning": mapping.warning,
            "requirements": RequirementSerializer(created_reqs, many=True).data if created_reqs else mapping.requirements,
        }, status=status.HTTP_201_CREATED)
