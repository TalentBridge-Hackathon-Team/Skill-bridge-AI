from django.urls import path
from .views import (
    JobAnalysisMatchView,
    JobAnalysisGapsView,
    EvidenceInspectView,
    RemediationAdviceView
)

urlpatterns = [
    path('<str:analysis_id>/match/', JobAnalysisMatchView.as_view(), name='job-analysis-match'),
    path('<str:analysis_id>/gaps/', JobAnalysisGapsView.as_view(), name='job-analysis-gaps'),
    path('inspect-evidence/', EvidenceInspectView.as_view(), name='inspect-evidence'),
    path('remediation-advice/', RemediationAdviceView.as_view(), name='remediation-advice'),
]
