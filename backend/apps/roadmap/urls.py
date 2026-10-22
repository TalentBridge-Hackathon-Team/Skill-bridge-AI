from django.urls import path
from .views import RoadmapListView, RoadmapTaskDetailView

urlpatterns = [
    path('', RoadmapListView.as_view(), name='roadmap-list'),
    path('<str:task_id>/', RoadmapTaskDetailView.as_view(), name='roadmap-task-detail'),
]
