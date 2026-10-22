from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import RoadmapTask, ApplicationChecklist
from .serializers import RoadmapTaskSerializer, ApplicationChecklistSerializer

class RoadmapListView(APIView):
    """
    GET /api/roadmap/
    Returns recommended roadmap tasks and optional Mode A application checklist for the user.
    """
    def get(self, request):
        user_id = request.query_params.get("user_id", "demo_user")
        tasks = RoadmapTask.objects.filter(user_id=user_id)
        checklist_items = ApplicationChecklist.objects.filter(user_id=user_id)

        task_serializer = RoadmapTaskSerializer(tasks, many=True)
        checklist_serializer = ApplicationChecklistSerializer(checklist_items, many=True)

        return Response({
            "user_id": user_id,
            "tasks": task_serializer.data,
            "checklist": checklist_serializer.data
        })

class RoadmapTaskDetailView(APIView):
    """
    PATCH /api/roadmap/{task_id}/
    Updates task progress (pending -> in_progress -> completed).
    """
    def patch(self, request, task_id):
        try:
            task = RoadmapTask.objects.get(task_id=task_id)
        except RoadmapTask.DoesNotExist:
            return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get("status")
        if new_status:
            task.status = new_status
            task.save()

        return Response(RoadmapTaskSerializer(task).data)
