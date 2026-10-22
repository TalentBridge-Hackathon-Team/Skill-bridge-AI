from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import AssessmentTask, AssessmentSubmission
from .serializers import AssessmentTaskSerializer, AssessmentSubmissionSerializer

class AssessmentDetailView(APIView):
    """
    GET /api/assessments/{task_id}/
    Retrieves task instructions and rubric definition.
    """
    def get(self, request, task_id):
        task, _ = AssessmentTask.objects.get_or_create(
            task_id=task_id,
            defaults={
                "title": "REST API Testing Assessment",
                "task_type": "api_testing",
                "target_skill": "API Testing",
                "total_points": 10,
                "instructions": "Given a sample endpoint, submit test cases and assertions.",
                "rubric": []
            }
        )
        return Response(AssessmentTaskSerializer(task).data)

class AssessmentSubmissionView(APIView):
    """
    POST /api/assessments/{task_id}/submissions/
    Submit test cases for rubric review and score recording.
    """
    def post(self, request, task_id):
        # TODO (Member 4): Implement rubric scoring evaluation
        submission_data = request.data.get("submission", {})
        return Response({
            "task_id": task_id,
            "message": "Submission received. Pending rubric evaluation.",
            "submission": submission_data
        }, status=status.HTTP_201_CREATED)
