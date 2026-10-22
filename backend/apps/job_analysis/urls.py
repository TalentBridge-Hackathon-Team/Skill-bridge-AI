from django.urls import path
from .views import (
    JobAnalysisListCreateView,
    JobAnalysisDetailView,
    JobAnalysisRequirementsUpdateView,
    GoalListCreateView
)

urlpatterns = [
    path('', JobAnalysisListCreateView.as_view(), name='job-analysis-list-create'),
    path('<str:analysis_id>/', JobAnalysisDetailView.as_view(), name='job-analysis-detail'),
    path('<str:analysis_id>/requirements/', JobAnalysisRequirementsUpdateView.as_view(), name='job-analysis-requirements-update'),
    path('goals/', GoalListCreateView.as_view(), name='goal-list-create'),
]
