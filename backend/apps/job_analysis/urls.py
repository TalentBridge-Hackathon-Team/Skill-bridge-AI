"""
SkillBridge AI — Job Analysis URL patterns
Note: 'goals/' is NOT included here because it's registered separately at the
root level as /api/goals/ in skillbridge_backend/urls.py.
The <str:analysis_id>/ wildcard would swallow 'goals/' if it were listed here
after the wildcard route.
"""

from django.urls import path
from .views import (
    JobAnalysisListCreateView,
    JobAnalysisDetailView,
    JobAnalysisRequirementsUpdateView,
)

urlpatterns = [
    # GET /api/job-analyses/         — list all analyses for a user
    # POST /api/job-analyses/        — create analysis + extract requirements
    path("", JobAnalysisListCreateView.as_view(), name="job-analysis-list-create"),

    # GET /api/job-analyses/{id}/    — retrieve single analysis with requirements
    path(
        "<str:analysis_id>/",
        JobAnalysisDetailView.as_view(),
        name="job-analysis-detail",
    ),

    # PATCH /api/job-analyses/{id}/requirements/  — human review & confirm
    path(
        "<str:analysis_id>/requirements/",
        JobAnalysisRequirementsUpdateView.as_view(),
        name="job-analysis-requirements-update",
    ),
]
