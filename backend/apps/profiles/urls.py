from django.urls import re_path
from .views import ProfileCreateView, ProfileMeView, ProfileEvidenceView, ResumeUploadView

urlpatterns = [
    # POST /api/profiles/  — create new profile
    re_path(r'^$', ProfileCreateView.as_view(), name='profile-create'),
    # GET/PUT /api/profiles/me/
    re_path(r'^me/?$', ProfileMeView.as_view(), name='profile-me'),
    # POST /api/profiles/me/evidence/
    re_path(r'^me/evidence/?$', ProfileEvidenceView.as_view(), name='profile-evidence'),
    # POST /api/profiles/me/resume/
    re_path(r'^me/resume/?$', ResumeUploadView.as_view(), name='profile-resume'),
]
