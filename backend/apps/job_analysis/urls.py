from django.urls import path
from .views import (
    JobAnalysisListCreateView,
    JobAnalysisDetailView,
    JobAnalysisRequirementsUpdateView,
    ProfilesListView,
)

urlpatterns = [
    # GET  /api/job-analyses/           — list analyses for user
    # POST /api/job-analyses/           — create + extract
    path("", JobAnalysisListCreateView.as_view(), name="job-analysis-list-create"),

    # GET  /api/job-analyses/{id}/      — retrieve single analysis
    path("<str:analysis_id>/", JobAnalysisDetailView.as_view(), name="job-analysis-detail"),

    # PATCH /api/job-analyses/{id}/requirements/  — human review & confirm
    path("<str:analysis_id>/requirements/",
         JobAnalysisRequirementsUpdateView.as_view(),
         name="job-analysis-requirements-update"),
]

# Separate URL list for the profiles listing — mounted at /api/skill-profiles/
skill_profile_urls = [
    path("", ProfilesListView.as_view(), name="skill-profiles-list"),
]
