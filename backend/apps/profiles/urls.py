from django.urls import path, re_path
from .views import ProfileMeView, ProfileEvidenceView, ResumeUploadView

urlpatterns = [
    re_path(r'^me/?$', ProfileMeView.as_view(), name='profile-me'),
    re_path(r'^me/evidence/?$', ProfileEvidenceView.as_view(), name='profile-evidence'),
    re_path(r'^me/resume/?$', ResumeUploadView.as_view(), name='profile-resume'),
]

