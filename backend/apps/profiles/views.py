from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import UserProfile, SkillEvidence
from .serializers import UserProfileSerializer, SkillEvidenceSerializer

class ProfileMeView(APIView):
    """
    GET /api/profiles/me/ - Retrieve user profile
    PUT /api/profiles/me/ - Update user profile
    """
    def get(self, request):
        user_id = request.query_params.get("user_id", "demo_user")
        profile = UserProfile.objects.filter(user_id=user_id).first()
        if not profile:
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
        user_id = request.data.get("user_id", "demo_user")
        profile, _ = UserProfile.objects.get_or_create(user_id=user_id)
        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

import uuid

class ProfileEvidenceView(APIView):
    """
    POST /api/profiles/me/evidence/ - Add new skill evidence
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

        serializer = SkillEvidenceSerializer(data=data)
        if serializer.is_valid():
            serializer.save(profile=profile)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

from services.aws_service import resume_pipeline

class ResumeUploadView(APIView):
    """
    POST /api/profiles/me/resume/ - Upload learner resume / CV
    Supports multipart file upload (.pdf, .docx, .txt).
    Uploads document to S3 and dispatches processing job to SQS for Lambda.
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user_id = request.data.get("user_id", "demo_user")
        file_obj = request.FILES.get("file")

        if not file_obj:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        profile, _ = UserProfile.objects.get_or_create(user_id=user_id)

        # 1. Upload resume to S3 (LocalStack / AWS) while file stream is open
        s3_res = resume_pipeline.upload_resume(
            file_obj,
            user_id=profile.user_id,
            filename=file_obj.name,
            content_type=getattr(file_obj, 'content_type', 'application/pdf')
        )

        profile.resume_file = file_obj
        profile.resume_parsed_text = f"Parsed text placeholder from {file_obj.name}"
        profile.save()


        # 2. Dispatch processing job to SQS queue for Lambda processing
        sqs_res = None
        if s3_res.get("success"):
            sqs_res = resume_pipeline.dispatch_processing_job(
                bucket=s3_res["bucket"],
                key=s3_res["key"],
                user_id=profile.user_id,
                filename=s3_res["filename"]
            )

        # 3. Create or update SkillEvidence record
        reference_url = s3_res.get("s3_url") if s3_res.get("success") else (profile.resume_file.url if profile.resume_file else "")
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

