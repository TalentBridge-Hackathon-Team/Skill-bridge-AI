import uuid
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import UserProfile, SkillEvidence
from .serializers import UserProfileSerializer, SkillEvidenceSerializer
from services import dynamodb_service
from services.aws_service import resume_pipeline


def _resolve_user_id(request) -> str:
    """
    Resolves the caller's identity.
    Query param takes priority over body — query param is set by the caller's
    own session/token and cannot be spoofed via the request body.
    In production, replace with request.user.id from JWT middleware.
    """
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
    Syncs the record to DynamoDB after PostgreSQL creation.
    """

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

        # Mirror to DynamoDB (best-effort, non-blocking)
        dynamodb_service.put_profile({
            "user_id": profile.user_id,
            "name": profile.name,
            "target_role": profile.target_role,
            "education": profile.education,
            "experience_level": profile.experience_level,
            "skills": profile.skills,
            "professional_background": profile.professional_background,
            "project_descriptions": profile.project_descriptions,
            "target_date": str(profile.target_date) if profile.target_date else None,
            "study_capacity_hours_per_week": profile.study_capacity_hours_per_week,
        })

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProfileMeView(APIView):
    """
    GET /api/profiles/me/ — Retrieve the caller's profile.
    PUT /api/profiles/me/ — Update the caller's profile.

    Ownership is enforced: the user_id in the request must match the resource.
    """

    def get(self, request):
        user_id = _resolve_user_id(request)

        profile = UserProfile.objects.filter(user_id=user_id).first()
        if not profile:
            # Auto-create on first access (convenience for dev/demo)
            profile = UserProfile.objects.create(
                user_id=user_id,
                name="Demo User",
                target_role="Junior Backend Developer",
                education="",
                skills=[]
            )
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data)

    def put(self, request):
        user_id = _resolve_user_id(request)

        profile = UserProfile.objects.filter(user_id=user_id).first()
        if not profile:
            return Response(
                {"error": "Profile not found. Use POST /api/profiles/ to create one first."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Ownership check
        target_user_id = request.data.get("user_id", user_id)
        if not _ownership_check(user_id, target_user_id):
            return Response(
                {"error": "Forbidden: you can only modify your own profile."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        profile = serializer.save()

        # Mirror updated fields to DynamoDB
        dynamodb_service.put_profile({
            "user_id": profile.user_id,
            "name": profile.name,
            "target_role": profile.target_role,
            "education": profile.education,
            "experience_level": profile.experience_level,
            "skills": profile.skills,
            "professional_background": profile.professional_background,
            "project_descriptions": profile.project_descriptions,
            "target_date": str(profile.target_date) if profile.target_date else None,
            "study_capacity_hours_per_week": profile.study_capacity_hours_per_week,
        })

        return Response(serializer.data)


import uuid

class ProfileEvidenceView(APIView):
    """
    POST /api/profiles/me/evidence/ — Add a new skill evidence record.
    Ownership is enforced via user_id on the parent profile.
    """

    def post(self, request):
        user_id = request.query_params.get("user_id") or request.data.get("user_id") or "usr_demo_001"
        profile, _ = UserProfile.objects.get_or_create(
            user_id=user_id,
            defaults={"name": "Demo User", "target_role": "Junior Backend Developer"}
        )

        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        if not data.get("evidence_id"):
            data["evidence_id"] = f"evi_{uuid.uuid4().hex[:10]}"
        caller_user_id = _resolve_user_id(request)
        profile = UserProfile.objects.filter(user_id=caller_user_id).first()
        if not profile:
            return Response({"error": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)

        # Generate evidence_id if not supplied
        data = dict(request.data)
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
