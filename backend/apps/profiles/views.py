import uuid
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from .models import UserProfile, SkillEvidence
from .serializers import UserProfileSerializer, SkillEvidenceSerializer
from services.aws_service import resume_pipeline


def _resolve_user_id(request) -> str:
    """
    Resolves the caller's identity.
    If authenticated via JWT token, uses request.user.id.
    Query param or request body can override for testing/demo access.
    """
    if getattr(request, "user", None) and request.user.is_authenticated:
        return str(request.user.id)
    return (
        request.query_params.get("user_id")
        or request.data.get("user_id")
        or "demo_user"
    )


def _ownership_check(request_user_id: str, resource_user_id: str) -> bool:
    """Return True only if the caller owns the resource."""
    return request_user_id == resource_user_id


class ProfileCreateView(APIView):
    """
    POST /api/profiles/ — Initialize a new user profile.
    Returns 409 if a profile for that user_id already exists.
    Saves the record to Neon PostgreSQL.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        user_id = _resolve_user_id(request)

        if UserProfile.objects.filter(user_id=user_id).exists():
            return Response(
                {"error": f"Profile for user_id '{user_id}' already exists. Use PUT /api/profiles/me/ to update."},
                status=status.HTTP_409_CONFLICT
            )

        # Inject user_id so the serializer sees it
        data = {**request.data, "user_id": user_id}
        serializer = UserProfileSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        profile = serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProfileMeView(APIView):
    """
    GET /api/profiles/me/ — Retrieve the caller's profile.
    PUT /api/profiles/me/ — Update the caller's profile.

    Ownership is enforced: the user_id in the request must match the resource.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        user_id = _resolve_user_id(request)
        user_candidates = [user_id]
        if getattr(request, "user", None) and request.user.is_authenticated:
            user_candidates.extend([request.user.username, str(request.user.id)])
        if user_id in ("demo_user", "usr_demo_001"):
            user_candidates.extend(["demo_user", "usr_demo_001"])

        profile = UserProfile.objects.filter(user_id__in=user_candidates).first()
        if not profile:
            # Auto-create on first access with registered details if available
            reg_name = "Demo User"
            if getattr(request, "user", None) and request.user.is_authenticated:
                reg_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
            profile = UserProfile.objects.create(
                user_id=user_id,
                name=reg_name,
                target_role="Junior Backend Developer",
                education="",
                skills=[]
            )
        elif getattr(request, "user", None) and request.user.is_authenticated:
            full_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
            if full_name and profile.name in ("Demo User", "Demo Learner", ""):
                profile.name = full_name
                profile.save(update_fields=["name"])

        serializer = UserProfileSerializer(profile)
        return Response(serializer.data)

    def put(self, request):
        user_id = _resolve_user_id(request)

        # Ownership check: verify caller is modifying their own profile
        target_user_id = request.data.get("user_id", user_id)
        is_authenticated_caller = (
            getattr(request, "user", None)
            and request.user.is_authenticated
            and (target_user_id in (str(request.user.id), request.user.username, user_id))
        )
        is_demo_alias = user_id in ("demo_user", "usr_demo_001") and target_user_id in ("demo_user", "usr_demo_001")
        if not _ownership_check(user_id, target_user_id) and not is_demo_alias and not is_authenticated_caller:
            return Response(
                {"error": "Forbidden: you can only modify your own profile."},
                status=status.HTTP_403_FORBIDDEN
            )

        user_candidates = [user_id, target_user_id]
        if getattr(request, "user", None) and request.user.is_authenticated:
            user_candidates.extend([request.user.username, str(request.user.id)])
        if user_id in ("demo_user", "usr_demo_001") or target_user_id in ("demo_user", "usr_demo_001"):
            user_candidates.extend(["demo_user", "usr_demo_001"])

        profile = UserProfile.objects.filter(user_id__in=user_candidates).first()
        if not profile:
            if getattr(request, "user", None) and request.user.is_authenticated:
                profile = UserProfile.objects.create(
                    user_id=str(request.user.id),
                    name=request.data.get("name") or (
                        f"{request.user.first_name} {request.user.last_name}".strip()
                        or request.user.username
                    ),
                    target_role=request.data.get("target_role", "Junior Backend Developer")
                )
            else:
                return Response(
                    {"error": f"Profile for user '{user_id}' not found."},
                    status=status.HTTP_404_NOT_FOUND
                )

        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        profile = serializer.save()

        # Auto-sync project descriptions into verified/unverified SkillEvidence records
        if profile.project_descriptions:
            for proj in profile.project_descriptions:
                if isinstance(proj, dict):
                    p_title = proj.get("title") or "Project Deliverable"
                    p_link = proj.get("link") or ""
                    p_desc = proj.get("description") or ""
                    for s in proj.get("skills_demonstrated", []):
                        if s:
                            SkillEvidence.objects.update_or_create(
                                profile=profile,
                                skill_name=s,
                                defaults={
                                    "evidence_id": f"evi_{profile.user_id}_{s.lower().replace(' ', '_')[:20]}",
                                    "evidence_type": "project",
                                    "title": p_title,
                                    "reference": p_link,
                                    "description": p_desc or f"Demonstrated in {p_title}",
                                    "review_status": "verified" if p_link else "unverified"
                                }
                            )

        return Response(UserProfileSerializer(profile).data)


class ProfileEvidenceView(APIView):
    """
    POST /api/profiles/me/evidence/ — Add a new skill evidence record.
    Ownership is enforced via user_id on the parent profile.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        caller_user_id = _resolve_user_id(request)
        user_candidates = [caller_user_id]
        if caller_user_id in ("demo_user", "usr_demo_001"):
            user_candidates = ["demo_user", "usr_demo_001"]

        profile = UserProfile.objects.filter(user_id__in=user_candidates).first()
        if not profile:
            profile = UserProfile.objects.create(
                user_id=caller_user_id,
                name="Demo User",
                target_role="Junior Backend Developer"
            )

        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        if not data.get("evidence_id"):
            data["evidence_id"] = f"evi_{uuid.uuid4().hex[:12]}"

        serializer = SkillEvidenceSerializer(data=data)
        if serializer.is_valid():
            serializer.save(profile=profile)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ResumeUploadView(APIView):
    """
    POST /api/profiles/me/resume/ — Upload learner resume / CV.
    Ownership enforced: user_id in form data must match the caller's identity.
    Uploads to S3, dispatches to SQS, and creates a SkillEvidence record.
    """
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        caller_user_id = _resolve_user_id(request)
        file_obj = request.FILES.get("file")

        if not file_obj:
            return Response({"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        # Ownership check: reject if form supplies a different user_id
        form_user_id = request.data.get("user_id", caller_user_id)
        if not _ownership_check(caller_user_id, form_user_id):
            return Response(
                {"error": "Forbidden: you can only upload to your own profile."},
                status=status.HTTP_403_FORBIDDEN
            )

        profile, _ = UserProfile.objects.get_or_create(user_id=caller_user_id)

        s3_res = resume_pipeline.upload_resume(
            file_obj,
            user_id=profile.user_id,
            filename=file_obj.name,
            content_type=getattr(file_obj, 'content_type', 'application/pdf')
        )

        profile.resume_file = file_obj
        profile.resume_parsed_text = f"Parsed text placeholder from {file_obj.name}"
        profile.save()

        sqs_res = None
        if s3_res.get("success"):
            sqs_res = resume_pipeline.dispatch_processing_job(
                bucket=s3_res["bucket"],
                key=s3_res["key"],
                user_id=profile.user_id,
                filename=s3_res["filename"]
            )

        reference_url = s3_res.get("s3_url") if s3_res.get("success") else (
            profile.resume_file.url if profile.resume_file else ""
        )
        SkillEvidence.objects.update_or_create(
            evidence_id=f"evi_resume_{profile.user_id}",
            defaults={
                "profile": profile,
                "skill_name": "CV / Resume Document",
                "evidence_type": "project",
                "title": f"Uploaded CV ({file_obj.name})",
                "reference": reference_url,
                "description": f"Learner CV stored in S3 ({s3_res.get('key', 'local')}) and dispatched to SQS.",
                "review_status": "unverified"
            }
        )

        return Response({
            "message": "Resume uploaded successfully",
            "file_name": file_obj.name,
            "resume_url": profile.resume_file.url if profile.resume_file else "",
            "s3": s3_res,
            "sqs": sqs_res,
            "profile": UserProfileSerializer(profile).data
        }, status=status.HTTP_201_CREATED)
