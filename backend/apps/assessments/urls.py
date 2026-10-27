from django.urls import path
from .views import (
    AssessmentDetailView,
    AssessmentSubmissionView,
    MicroLessonProgressView,
    MicroLessonChatView,
    DynamicSyllabusGeneratorView,
)

urlpatterns = [
    path('generate-syllabus/', DynamicSyllabusGeneratorView.as_view(), name='generate-syllabus'),
    path('micro-lesson/progress/', MicroLessonProgressView.as_view(), name='microlesson-progress'),
    path('micro-lesson/chat/', MicroLessonChatView.as_view(), name='microlesson-chat'),
    path('<str:task_id>/microlesson/', MicroLessonChatView.as_view(), name='assessment-microlesson-chat'),
    path('<str:task_id>/', AssessmentDetailView.as_view(), name='assessment-detail'),
    path('<str:task_id>/submissions/', AssessmentSubmissionView.as_view(), name='assessment-submission'),
]
