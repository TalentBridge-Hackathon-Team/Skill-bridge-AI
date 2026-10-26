from django.urls import path
from .views import RoadmapListView, RoadmapRecalculateView, RoadmapTaskDetailView

urlpatterns = [
    path('', RoadmapListView.as_view(), name='roadmap-list'),
    path('recalculate/', RoadmapRecalculateView.as_view(), name='roadmap-recalculate'),
    path('<str:task_id>/', RoadmapTaskDetailView.as_view(), name='roadmap-task-detail'),
]
