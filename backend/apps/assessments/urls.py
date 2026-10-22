from django.urls import path
from .views import AssessmentDetailView, AssessmentSubmissionView

urlpatterns = [
    path('<str:task_id>/', AssessmentDetailView.as_view(), name='assessment-detail'),
    path('<str:task_id>/submissions/', AssessmentSubmissionView.as_view(), name='assessment-submission'),
]
