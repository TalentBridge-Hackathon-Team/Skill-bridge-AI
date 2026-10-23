"""
SkillBridge AI — Job & Goal Analysis Tests
Member 2 responsibility — covers normal input, invalid input, ambiguous goals,
malformed AI output, and Bedrock/OpenRouter failure scenarios.

Run with:
    cd backend
    pytest apps/job_analysis/test_job_analysis.py -v

All tests use in-memory SQLite (auto-configured in settings.py when pytest runs).
No real AWS or OpenRouter credentials are needed — all AI calls are mocked.
"""

from unittest.mock import MagicMock, patch

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.job_analysis.goal_mapper import map_goal_to_profile
from apps.job_analysis.models import Goal, JobAnalysis, Requirement
from apps.job_analysis.validators import (
    validate_days_remaining,
    validate_goal_text,
    validate_goal_type,
    validate_job_text,
    validate_requirements_list,
    validate_study_hours,
)
from rest_framework.exceptions import ValidationError


# =============================================================================
# Validator unit tests (no database, no HTTP)
# =============================================================================

class TestJobTextValidator(TestCase):

    def test_valid_text_is_returned_stripped(self):
        text = "  We are hiring a Python developer with Django experience.  "
        result = validate_job_text(text)
        self.assertEqual(result, text.strip())

    def test_empty_string_raises(self):
        with self.assertRaises(ValidationError) as ctx:
            validate_job_text("")
        self.assertIn("job_text", ctx.exception.detail)

    def test_whitespace_only_raises(self):
        with self.assertRaises(ValidationError):
            validate_job_text("   \n\t  ")

    def test_too_short_raises(self):
        with self.assertRaises(ValidationError) as ctx:
            validate_job_text("Hi")
        self.assertIn("too short", str(ctx.exception.detail))

    def test_too_long_raises(self):
        with self.assertRaises(ValidationError) as ctx:
            validate_job_text("a" * 16_000)
        self.assertIn("too long", str(ctx.exception.detail))

    def test_non_string_raises(self):
        with self.assertRaises(ValidationError):
            validate_job_text(12345)


class TestGoalTextValidator(TestCase):

    def test_valid_goal(self):
        result = validate_goal_text("  become a backend developer  ")
        self.assertEqual(result, "become a backend developer")

    def test_empty_goal_raises(self):
        with self.assertRaises(ValidationError):
            validate_goal_text("")

    def test_too_short_raises(self):
        with self.assertRaises(ValidationError):
            validate_goal_text("Hi")

    def test_too_long_raises(self):
        with self.assertRaises(ValidationError):
            validate_goal_text("a" * 600)

    def test_valid_goal_types(self):
        for gt in ("job_opportunity", "career_role", "skill_goal"):
            result = validate_goal_type(gt)
            self.assertEqual(result, gt)

    def test_invalid_goal_type_raises(self):
        with self.assertRaises(ValidationError):
            validate_goal_type("dream_job")


class TestNumericValidators(TestCase):

    def test_valid_days(self):
        self.assertEqual(validate_days_remaining("14"), 14)
        self.assertEqual(validate_days_remaining(30), 30)

    def test_days_less_than_one_raises(self):
        with self.assertRaises(ValidationError):
            validate_days_remaining(0)

    def test_days_over_limit_raises(self):
        with self.assertRaises(ValidationError):
            validate_days_remaining(400)

    def test_days_non_numeric_raises(self):
        with self.assertRaises(ValidationError):
            validate_days_remaining("two weeks")

    def test_valid_hours(self):
        self.assertAlmostEqual(validate_study_hours("14.0"), 14.0)
        self.assertAlmostEqual(validate_study_hours(7), 7.0)

    def test_hours_zero_raises(self):
        with self.assertRaises(ValidationError):
            validate_study_hours(0)

    def test_hours_over_limit_raises(self):
        with self.assertRaises(ValidationError):
            validate_study_hours(200)


class TestRequirementsListValidator(TestCase):

    def test_valid_list(self):
        items = [
            {"skill_name": "Python", "category": "language", "importance": "required",
             "source_excerpt": "Python required"},
        ]
        result = validate_requirements_list(items)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["skill_name"], "Python")

    def test_empty_list_raises(self):
        with self.assertRaises(ValidationError):
            validate_requirements_list([])

    def test_non_list_raises(self):
        with self.assertRaises(ValidationError):
            validate_requirements_list("not a list")

    def test_item_missing_skill_name_raises(self):
        with self.assertRaises(ValidationError):
            validate_requirements_list([{"category": "language", "importance": "required"}])

    def test_invalid_importance_raises(self):
        with self.assertRaises(ValidationError):
            validate_requirements_list([
                {"skill_name": "Python", "importance": "mandatory"}
            ])

    def test_invalid_category_is_coerced_to_concepts(self):
        items = [{"skill_name": "Python", "importance": "required", "category": "unknown_xyz"}]
        result = validate_requirements_list(items)
        self.assertEqual(result[0]["category"], "concepts")

    def test_too_many_items_raises(self):
        items = [{"skill_name": f"Skill{i}", "importance": "required"} for i in range(51)]
        with self.assertRaises(ValidationError):
            validate_requirements_list(items)


# =============================================================================
# Goal mapper unit tests
# =============================================================================

class TestGoalMapper(TestCase):

    def test_clear_backend_goal_maps_correctly(self):
        result = map_goal_to_profile("I want to become a Junior Backend Developer")
        self.assertEqual(result.profile_id, "prof_junior_backend")
        self.assertIn(result.confidence, ("high", "medium"))
        self.assertIsNone(result.warning)
        self.assertGreater(len(result.requirements), 0)

    def test_python_django_goal_maps_correctly(self):
        result = map_goal_to_profile("Get a job as a Python Django developer")
        self.assertEqual(result.profile_id, "prof_junior_backend")
        self.assertGreater(len(result.matched_keywords), 1)

    def test_ambiguous_goal_gets_low_confidence_and_warning(self):
        result = map_goal_to_profile("I want a job in tech")
        self.assertEqual(result.confidence, "low")
        self.assertIsNotNone(result.warning)
        # Still returns a usable profile (default)
        self.assertEqual(result.profile_id, "prof_junior_backend")
        self.assertGreater(len(result.requirements), 0)

    def test_very_ambiguous_goal_still_returns_requirements(self):
        result = map_goal_to_profile("I want a good career")
        self.assertIsNotNone(result)
        self.assertGreater(len(result.requirements), 0)

    def test_skill_specific_goal(self):
        result = map_goal_to_profile("I want to learn Django REST Framework and PostgreSQL")
        self.assertEqual(result.profile_id, "prof_junior_backend")

    def test_internship_goal(self):
        result = map_goal_to_profile("I am looking for a backend internship")
        self.assertEqual(result.profile_id, "prof_junior_backend")
        self.assertIn("backend internship", result.matched_keywords)


# =============================================================================
# API integration tests (uses Django test client + SQLite)
# =============================================================================

VALID_JOB_TEXT = (
    "We are seeking a Junior Backend Developer proficient in Python, Django REST Framework, "
    "and PostgreSQL. You will design and build RESTful APIs, write unit and integration tests "
    "using pytest, and work with Git for version control. Docker experience is a plus."
)


class JobAnalysisAPITests(TestCase):

    def setUp(self):
        self.client = APIClient()

    # ── Normal cases ──────────────────────────────────────────────────────────

    def test_submit_valid_job_text_returns_201(self):
        response = self.client.post(
            "/api/job-analyses/",
            {"job_text": VALID_JOB_TEXT},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("analysis_id", response.data)
        self.assertIn("requirements", response.data)
        self.assertIsInstance(response.data["requirements"], list)
        self.assertGreater(len(response.data["requirements"]), 0)

    def test_submit_stores_in_database(self):
        self.client.post(
            "/api/job-analyses/",
            {"job_text": VALID_JOB_TEXT},
            format="json",
        )
        self.assertEqual(JobAnalysis.objects.count(), 1)
        analysis = JobAnalysis.objects.first()
        self.assertEqual(analysis.mode, "job_specific")
        self.assertGreater(analysis.requirements.count(), 0)

    def test_get_analysis_by_id(self):
        post_response = self.client.post(
            "/api/job-analyses/",
            {"job_text": VALID_JOB_TEXT},
            format="json",
        )
        analysis_id = post_response.data["analysis_id"]
        get_response = self.client.get(f"/api/job-analyses/{analysis_id}/")
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data["analysis_id"], analysis_id)

    def test_list_analyses_for_user(self):
        self.client.post(
            "/api/job-analyses/",
            {"job_text": VALID_JOB_TEXT, "user_id": "test_user_list"},
            format="json",
        )
        response = self.client.get("/api/job-analyses/?user_id=test_user_list")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    # ── Invalid input cases ───────────────────────────────────────────────────

    def test_reject_empty_job_text(self):
        response = self.client.post(
            "/api/job-analyses/", {"job_text": ""}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_missing_body(self):
        response = self.client.post("/api/job-analyses/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_whitespace_only_text(self):
        response = self.client.post(
            "/api/job-analyses/", {"job_text": "   \n\t  "}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_too_short_text(self):
        response = self.client.post(
            "/api/job-analyses/", {"job_text": "Hire me"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_oversized_job_description(self):
        response = self.client.post(
            "/api/job-analyses/",
            {"job_text": "Python developer. " * 1000},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        error_text = str(response.data)
        self.assertIn("too long", error_text)

    def test_reject_invalid_days_remaining(self):
        response = self.client.post(
            "/api/job-analyses/",
            {"job_text": VALID_JOB_TEXT, "days_remaining": "not-a-number"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_days_remaining_zero(self):
        response = self.client.post(
            "/api/job-analyses/",
            {"job_text": VALID_JOB_TEXT, "days_remaining": 0},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_404_for_nonexistent_analysis(self):
        response = self.client.get("/api/job-analyses/job_does_not_exist/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── Requirements update (human review) ────────────────────────────────────

    def test_confirm_requirements_replaces_list(self):
        post_response = self.client.post(
            "/api/job-analyses/",
            {"job_text": VALID_JOB_TEXT},
            format="json",
        )
        analysis_id = post_response.data["analysis_id"]

        patch_response = self.client.patch(
            f"/api/job-analyses/{analysis_id}/requirements/",
            {
                "requirements": [
                    {
                        "skill_name": "Python",
                        "category": "language",
                        "importance": "required",
                        "source_excerpt": "Confirmed by user",
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data["analysis_id"], analysis_id)

        # Verify database was updated
        req_count = Requirement.objects.filter(analysis__analysis_id=analysis_id).count()
        self.assertEqual(req_count, 1)

    def test_confirm_empty_requirements_rejected(self):
        post_response = self.client.post(
            "/api/job-analyses/",
            {"job_text": VALID_JOB_TEXT},
            format="json",
        )
        analysis_id = post_response.data["analysis_id"]

        patch_response = self.client.patch(
            f"/api/job-analyses/{analysis_id}/requirements/",
            {"requirements": []},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_missing_requirements_field_rejected(self):
        post_response = self.client.post(
            "/api/job-analyses/",
            {"job_text": VALID_JOB_TEXT},
            format="json",
        )
        analysis_id = post_response.data["analysis_id"]

        patch_response = self.client.patch(
            f"/api/job-analyses/{analysis_id}/requirements/",
            {},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_invalid_importance_rejected(self):
        post_response = self.client.post(
            "/api/job-analyses/",
            {"job_text": VALID_JOB_TEXT},
            format="json",
        )
        analysis_id = post_response.data["analysis_id"]

        patch_response = self.client.patch(
            f"/api/job-analyses/{analysis_id}/requirements/",
            {
                "requirements": [
                    {"skill_name": "Python", "importance": "mandatory"}
                ]
            },
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Malformed AI output handling ──────────────────────────────────────────

    @patch("apps.job_analysis.views.bedrock_extractor")
    def test_malformed_ai_output_falls_back_gracefully(self, mock_extractor):
        """When the AI service returns garbage, the rule engine kicks in."""
        from services.bedrock_service import _rule_engine_extract

        mock_extractor.extract_job_requirements.return_value = {
            "role_title": "Unknown",
            "summary": "",
            "requirements": [],          # empty — triggers rule engine fallback
            "extraction_source": "openrouter",
        }

        response = self.client.post(
            "/api/job-analyses/",
            {"job_text": VALID_JOB_TEXT},
            format="json",
        )
        # Should still succeed because rule engine provides defaults
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertGreater(len(response.data["requirements"]), 0)

    @patch("apps.job_analysis.views.bedrock_extractor")
    def test_ai_service_exception_falls_back_gracefully(self, mock_extractor):
        """When the AI service raises an exception entirely, the view recovers."""
        mock_extractor.extract_job_requirements.side_effect = RuntimeError(
            "Simulated Bedrock timeout"
        )

        response = self.client.post(
            "/api/job-analyses/",
            {"job_text": VALID_JOB_TEXT},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("analysis_id", response.data)

    # ── Bedrock unavailability ─────────────────────────────────────────────────

    @patch("services.bedrock_service._extract_via_bedrock")
    def test_bedrock_failure_falls_back_to_openrouter(self, mock_bedrock):
        """Bedrock raises ClientError → should fall back to OpenRouter."""
        mock_bedrock.side_effect = Exception("Simulated Bedrock ClientError")

        import os
        with patch.dict(
            os.environ,
            {
                "AWS_ACCESS_KEY_ID": "REAL_KEY_SIMULATION",
                "AWS_SECRET_ACCESS_KEY": "REAL_SECRET_SIMULATION",
            },
        ):
            from services.bedrock_service import BedrockExtractionService
            service = BedrockExtractionService()
            result = service.extract_job_requirements(VALID_JOB_TEXT)

        # Rule engine or OpenRouter should have provided results
        self.assertIn("requirements", result)
        self.assertIsInstance(result["requirements"], list)
        self.assertGreater(len(result["requirements"]), 0)

    def test_bedrock_health_check_structure(self):
        from services.bedrock_service import bedrock_extractor
        health = bedrock_extractor.health_check()
        self.assertIn("bedrock", health)
        self.assertIn("openrouter", health)
        self.assertIn("rule_engine", health)
        self.assertTrue(health["rule_engine"]["available"])


# =============================================================================
# Goals API tests
# =============================================================================

class GoalAPITests(TestCase):

    def setUp(self):
        self.client = APIClient()

    def test_create_valid_career_goal(self):
        response = self.client.post(
            "/api/goals/",
            {
                "goal_text": "I want to become a Junior Backend Developer using Python",
                "goal_type": "career_role",
                "user_id": "test_user",
                "days_remaining": 30,
                "study_hours_per_week": 10.0,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("goal", response.data)
        self.assertIn("requirements", response.data)
        self.assertIn("profile_id", response.data)
        self.assertIsInstance(response.data["requirements"], list)
        self.assertGreater(len(response.data["requirements"]), 0)

    def test_goal_saved_to_database(self):
        self.client.post(
            "/api/goals/",
            {
                "goal_text": "I want to learn Django and build REST APIs",
                "goal_type": "skill_goal",
                "user_id": "db_test_user",
            },
            format="json",
        )
        self.assertEqual(Goal.objects.count(), 1)
        goal = Goal.objects.first()
        self.assertEqual(goal.target_profile_id, "prof_junior_backend")

    def test_reject_empty_goal_text(self):
        response = self.client.post(
            "/api/goals/",
            {"goal_text": "", "goal_type": "career_role"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_whitespace_only_goal(self):
        response = self.client.post(
            "/api/goals/",
            {"goal_text": "   ", "goal_type": "career_role"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_invalid_goal_type(self):
        response = self.client.post(
            "/api/goals/",
            {"goal_text": "I want to learn Python", "goal_type": "dream_job"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ambiguous_goal_still_succeeds_with_warning(self):
        """An ambiguous goal should return 201 but include a warning."""
        response = self.client.post(
            "/api/goals/",
            {"goal_text": "I want a great career in technology"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(response.data.get("warning"))
        self.assertEqual(response.data.get("confidence"), "low")
        # Requirements still present (default profile used)
        self.assertGreater(len(response.data["requirements"]), 0)

    def test_list_goals_for_user(self):
        self.client.post(
            "/api/goals/",
            {
                "goal_text": "I want to be a backend developer",
                "user_id": "list_test_user",
            },
            format="json",
        )
        response = self.client.get("/api/goals/?user_id=list_test_user")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_goal_type_defaults_to_career_role(self):
        """When goal_type is omitted, it defaults to career_role."""
        response = self.client.post(
            "/api/goals/",
            {"goal_text": "I want to become a backend developer"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["goal"]["goal_type"], "career_role")

    def test_goal_includes_role_title_in_response(self):
        response = self.client.post(
            "/api/goals/",
            {"goal_text": "I want to become a backend developer using Python"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("role_title", response.data)
        self.assertEqual(response.data["role_title"], "Junior Backend Developer")
