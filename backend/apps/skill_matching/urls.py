from django.urls import path
from .views import JobAnalysisMatchView, JobAnalysisGapsView

urlpatterns = [
    path('<str:analysis_id>/match/', JobAnalysisMatchView.as_view(), name='job-analysis-match'),
    path('<str:analysis_id>/gaps/', JobAnalysisGapsView.as_view(), name='job-analysis-gaps'),
]
