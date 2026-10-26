from django.db import migrations

def seed_roadmap_and_checklist(apps, schema_editor):
    RoadmapTask = apps.get_model('roadmap', 'RoadmapTask')
    ApplicationChecklist = apps.get_model('roadmap', 'ApplicationChecklist')

    users = ['usr_demo_001', 'demo_user']
    for user_id in users:
        if not RoadmapTask.objects.filter(user_id=user_id).exists():
            RoadmapTask.objects.create(
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
            )
            RoadmapTask.objects.create(
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
            )
            RoadmapTask.objects.create(
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

        if not ApplicationChecklist.objects.filter(user_id=user_id).exists():
            ApplicationChecklist.objects.create(
                item_id=f"chk_1_{user_id}",
                user_id=user_id,
                title="Tailor CV to Highlight Demonstrated Evidence",
                description="Ensure CV cites the E-Commerce API and API testing suite prominently rather than listing plain keywords.",
                completed=True,
                category="cv"
            )
            ApplicationChecklist.objects.create(
                item_id=f"chk_2_{user_id}",
                user_id=user_id,
                title="GitHub Repository Readme Hygiene",
                description="Include an architectural diagram, LocalStack setup instructions, and sample test outputs in the project README.",
                completed=False,
                category="portfolio"
            )
            ApplicationChecklist.objects.create(
                item_id=f"chk_3_{user_id}",
                user_id=user_id,
                title="Prepare Talking Points for PostgreSQL Vector Search",
                description="Be prepared to explain pgvector indexing, cosine similarity metrics, and trade-offs compared to standalone vector DBs.",
                completed=False,
                category="application"
            )

def reverse_seed(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('roadmap', '0002_applicationchecklist_roadmaptask_action_deliverable_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_roadmap_and_checklist, reverse_seed),
    ]
