"""
SkillBridge AI URL Configuration
Maps directly to API Endpoints defined in Blueprint 2.0 (Section 12):
- /api/profiles/
- /api/job-analyses/
- /api/goals/
- /api/job-analyses/{id}/match/
- /api/job-analyses/{id}/gaps/
- /api/assessments/
- /api/roadmap/
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from apps.job_analysis.views import GoalListCreateView

from django.http import JsonResponse

def api_root_view(request):
    return JsonResponse({
        "project": "SkillBridge AI Backend API",
        "status": "online",
        "endpoints": {
            "profiles": "/api/profiles/me/",
            "goals": "/api/goals/",
            "job_analyses": "/api/job-analyses/",
            "assessments": "/api/assessments/",
            "roadmap": "/api/roadmap/",
            "admin": "/admin/"
        }
    })

urlpatterns = [
    path('', api_root_view, name='api-root'),
    path('admin/', admin.site.urls),
    path('api/profiles/', include('apps.profiles.urls')),
    path('api/goals/', GoalListCreateView.as_view(), name='api-goals'),
    path('api/job-analyses/', include('apps.job_analysis.urls')),
    path('api/job-analyses/', include('apps.skill_matching.urls')),
    path('api/skill-matching/', include('apps.skill_matching.urls')),
    path('api/assessments/', include('apps.assessments.urls')),
    path('api/roadmap/', include('apps.roadmap.urls')),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
