from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone
from .models import RoadmapTask, ApplicationChecklist
from .serializers import RoadmapTaskSerializer, ApplicationChecklistSerializer

def ensure_default_roadmap(user_id: str):
    """Initializes default Roadmap tasks and checklist items if none exist."""
    tasks = RoadmapTask.objects.filter(user_id=user_id)
    if not tasks.exists():
        default_tasks = [
            RoadmapTask(
                task_id=f"tsk_001_{user_id}",
                user_id=user_id,
                title="Complete REST API Testing Assessment",
                target_skill="API Testing",
                priority="High",
                status="pending",
                action_deliverable="Write 3 complete test cases (success 201, invalid input 400, auth rejection 401) and evaluate against the 10-point published rubric.",
                completion_definition="Score at least 8/10 on the rubric to convert status from Unverified to Demonstrated.",
                effort_hours_estimate=6.0,
                expected_evidence="Rubric score summary and test case assertions.",
                due_date="Day 5 of 14-day plan",
                milestone="Milestone 1: Core Testing Verification",
                curated_resources=[
                    {"title": "Django REST Framework Testing Guide", "source": "django-rest-framework.org", "url": "https://www.django-rest-framework.org/api-guide/testing/", "type": "docs"},
                    {"title": "pytest-django Quickstart", "source": "pytest-django.readthedocs.io", "url": "https://pytest-django.readthedocs.io/en/latest/", "type": "tutorial"}
                ]
            ),
            RoadmapTask(
                task_id=f"tsk_002_{user_id}",
                user_id=user_id,
                title="Connect PostgreSQL Project Repository & Schema Evidence",
                target_skill="PostgreSQL",
                priority="High",
                status="pending",
                action_deliverable="Link a repository containing relational schema definitions, migrations, and parameterized SQL queries.",
                completion_definition="Valid repository URL linked in Profile & Evidence tab with verified status.",
                effort_hours_estimate=8.0,
                expected_evidence="GitHub repository URL with schema.sql or Django models.py migration history.",
                due_date="Day 9 of 14-day plan",
                milestone="Milestone 2: Database Competency",
                curated_resources=[
                    {"title": "PostgreSQL Documentation: Queries & Indexes", "source": "postgresql.org", "url": "https://www.postgresql.org/docs/current/queries.html", "type": "docs"}
                ]
            ),
            RoadmapTask(
                task_id=f"tsk_003_{user_id}",
                user_id=user_id,
                title="Document Authentication & JWT Expiration Edge Cases",
                target_skill="Authentication & Security",
                priority="Medium",
                status="pending",
                action_deliverable="Create README section demonstrating token refresh, expired token rejection, and role-based permissions.",
                completion_definition="Clear markdown documentation with curl/HTTP examples.",
                effort_hours_estimate=4.0,
                expected_evidence="Markdown documentation or snippet in linked repo.",
                due_date="Day 12 of 14-day plan",
                milestone="Milestone 3: Security & Polish",
                curated_resources=[
                    {"title": "Simple JWT Documentation for Django REST", "source": "django-rest-framework-simplejwt.readthedocs.io", "url": "https://django-rest-framework-simplejwt.readthedocs.io/en/latest/", "type": "docs"}
                ]
            )
        ]
        RoadmapTask.objects.bulk_create(default_tasks, ignore_conflicts=True)

    checklist_items = ApplicationChecklist.objects.filter(user_id=user_id)
    if not checklist_items.exists():
        default_checklist = [
            ApplicationChecklist(
                item_id=f"chk_1_{user_id}",
                user_id=user_id,
                title="Tailor CV to Highlight Demonstrated Evidence",
                description="Ensure CV cites the E-Commerce API and API testing suite prominently rather than listing plain keywords.",
                completed=True,
                category="cv"
            ),
            ApplicationChecklist(
                item_id=f"chk_2_{user_id}",
                user_id=user_id,
                title="GitHub Repository Readme Hygiene",
                description="Include an architectural diagram, LocalStack setup instructions, and sample test outputs in the project README.",
                completed=False,
                category="portfolio"
            ),
            ApplicationChecklist(
                item_id=f"chk_3_{user_id}",
                user_id=user_id,
                title="Prepare Talking Points for PostgreSQL Vector Search",
                description="Be prepared to explain pgvector indexing, cosine similarity metrics, and trade-offs compared to standalone vector DBs.",
                completed=False,
                category="application"
            )
        ]
        ApplicationChecklist.objects.bulk_create(default_checklist, ignore_conflicts=True)

def calculate_feasibility(remaining_hours: float, deadline_days: int, daily_available: float = 2.5):
    """Calculates burn rate, required daily hours, and feasibility rating."""
    daily_pace = round(remaining_hours / max(1, deadline_days), 2)
    
    if daily_pace <= daily_available * 0.75:
        return {
            "status": "Optimal / Comfortable",
            "score": 95,
            "color": "emerald",
            "daily_pace": daily_pace,
            "guidance": "Pace is very manageable. Time available for deep-dive polish and mock interview rehearsal."
        }
    elif daily_pace <= daily_available * 1.1:
        return {
            "status": "On Track",
            "score": 80,
            "color": "blue",
            "daily_pace": daily_pace,
            "guidance": "Steady pace aligned with your deadline. Maintain 2 hours per day to finish on time."
        }
    elif daily_pace <= daily_available * 1.5:
        return {
            "status": "Tight / Accelerated",
            "score": 55,
            "color": "amber",
            "daily_pace": daily_pace,
            "guidance": "Accelerated effort needed. Consider focusing strictly on High Priority deliverables."
        }
    else:
        return {
            "status": "At Risk / Overloaded",
            "score": 35,
            "color": "rose",
            "daily_pace": daily_pace,
            "guidance": "Schedule exceeds available bandwidth. Consider extending target deadline by 4-7 days."
        }


class RoadmapListView(APIView):
    """
    GET /api/roadmap/
    Returns recommended roadmap tasks, application checklist, effort metrics, and deadline feasibility.
    """
    permission_classes = [AllowAny]
    def get(self, request):
        auth_id = str(request.user.id) if (getattr(request, "user", None) and request.user.is_authenticated) else None
        effective_uid = auth_id or request.query_params.get("user_id")

        if not effective_uid or effective_uid in ("usr_demo_001", "demo_user"):
            user_candidates = ["usr_demo_001", "demo_user"]
            for uid in user_candidates:
                ensure_default_roadmap(uid)
        else:
            user_candidates = [str(effective_uid)]
            if auth_id:
                user_candidates.append(auth_id)
                if getattr(request.user, "username", None):
                    user_candidates.append(request.user.username)
            user_candidates = list(set(filter(None, user_candidates)))

        # Cross-synchronize with completed assessments and verified profile evidence
        try:
            from apps.assessments.models import AssessmentSubmission
            from apps.profiles.models import SkillEvidence

            passed_skills = set(
                AssessmentSubmission.objects.filter(
                    user_id__in=user_candidates,
                    score__gte=8
                ).values_list("task__target_skill", flat=True)
            )
            verified_evidence_skills = set(
                SkillEvidence.objects.filter(
                    profile__user_id__in=user_candidates,
                    review_status="verified"
                ).values_list("skill_name", flat=True)
            )
            all_verified = {s.lower().strip() for s in (passed_skills | verified_evidence_skills) if s}

            for uid in user_candidates:
                user_tasks = RoadmapTask.objects.filter(user_id=uid)
                for t in user_tasks:
                    if t.status != "completed" and t.target_skill:
                        t_norm = t.target_skill.lower().strip()
                        if any(v in t_norm or t_norm in v for v in all_verified):
                            t.status = "completed"
                            t.completed_at = timezone.now()
                            t.save()
        except Exception:
            pass

        tasks = RoadmapTask.objects.filter(user_id__in=user_candidates).order_by("created_at")
        checklist_items = ApplicationChecklist.objects.filter(user_id__in=user_candidates)

        task_serializer = RoadmapTaskSerializer(tasks, many=True)
        checklist_serializer = ApplicationChecklistSerializer(checklist_items, many=True)

        completed_tasks = tasks.filter(status="completed")
        remaining_tasks = tasks.exclude(status="completed")

        total_effort = sum(t.effort_hours_estimate for t in tasks)
        remaining_effort = sum(t.effort_hours_estimate for t in remaining_tasks)
        completed_effort = total_effort - remaining_effort

        feasibility = calculate_feasibility(remaining_effort, deadline_days, daily_available)

        return Response({
            "user_id": user_id,
            "tasks": task_serializer.data,
            "checklist": checklist_serializer.data,
            "metrics": {
                "total_tasks": tasks.count(),
                "completed_tasks": completed_tasks.count(),
                "completion_percentage": round((completed_tasks.count() / max(1, tasks.count())) * 100, 1),
                "total_effort_hours": total_effort,
                "remaining_effort_hours": remaining_effort,
                "completed_effort_hours": completed_effort,
                "deadline_days": deadline_days,
                "daily_available_hours": daily_available,
                "feasibility": feasibility
            }
        })


class RoadmapRecalculateView(APIView):
    """
    POST /api/roadmap/recalculate/
    Dynamically recalculates roadmap burn-down, feasibility, and task pacing based on
    updated user constraints (e.g. deadline changes, hours/day availability).
    """
    permission_classes = [AllowAny]
    def post(self, request):
        user_id = request.data.get("user_id", "demo_user")
        deadline_days = int(request.data.get("deadline_days", 14))
        daily_available = float(request.data.get("daily_available_hours", 2.5))
        rebalance = request.data.get("rebalance_priority", True)

        ensure_default_roadmap(user_id)
        tasks = RoadmapTask.objects.filter(user_id=user_id)
        
        remaining_tasks = tasks.exclude(status="completed")
        remaining_effort = sum(t.effort_hours_estimate for t in remaining_tasks)
        completed_count = tasks.filter(status="completed").count()

        # Dynamic priority rebalancing if deadline is compressed
        if rebalance and deadline_days <= 7:
            # Escalate urgent core tasks
            for t in remaining_tasks:
                if t.target_skill in ["API Testing", "PostgreSQL"]:
                    t.priority = "High"
                    t.save()

        feasibility = calculate_feasibility(remaining_effort, deadline_days, daily_available)
        task_serializer = RoadmapTaskSerializer(tasks, many=True)

        return Response({
            "user_id": user_id,
            "message": "Roadmap plan successfully recalculated.",
            "recalculated_at": timezone.now().isoformat(),
            "feasibility": feasibility,
            "metrics": {
                "remaining_effort_hours": remaining_effort,
                "deadline_days": deadline_days,
                "completed_tasks": completed_count,
                "total_tasks": tasks.count(),
                "completion_percentage": round((completed_count / max(1, tasks.count())) * 100, 1)
            },
            "tasks": task_serializer.data
        }, status=status.HTTP_200_OK)


class RoadmapTaskDetailView(APIView):
    """
    PATCH /api/roadmap/{task_id}/
    Updates task progress (pending -> in_progress -> completed).
    """
    permission_classes = [AllowAny]
    def patch(self, request, task_id):
        try:
            task = RoadmapTask.objects.get(task_id=task_id)
        except RoadmapTask.DoesNotExist:
            return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get("status")
        if new_status:
            task.status = new_status
            if new_status == "completed" and not task.completed_at:
                task.completed_at = timezone.now()
            elif new_status != "completed":
                task.completed_at = None
            task.save()

        return Response(RoadmapTaskSerializer(task).data)
