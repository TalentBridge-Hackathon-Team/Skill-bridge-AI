"""
SkillBridge AI — Job & Goal Analysis Tests
Covers: validators, goal mapper (multi-role), API endpoints, OpenRouter failure
        scenarios, malformed AI output, and the human review workflow.

Run with:
    cd backend
    pytest apps/job_analysis/test_job_analysis.py -v

All tests use in-memory SQLite (auto-configured in settings.py when pytest runs).
Authentication is bypassed via force_authenticate so no JWT setup is needed.
OpenRouter calls are mocked — no real API key is required.
"""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.exceptions import ValidationError
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


# =============================================================================
# Helpers
# =============================================================================

def make_client_with_user():
    """Returns an APIClient authenticated as a fresh test user."""
    user = User.objects.create_user(
        username=f"user_{User.objects.count()}",
        email=f"user{User.objects.count()}@test.com",
        password="TestPass123!",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


# =============================================================================
# Validator unit tests
# =============================================================================

class TestJobTextValidator(TestCase):

    def test_valid_text_stripped(self):
        text = "  We need a Python developer with Django experience for our startup.  "
        self.assertEqual(validate_job_text(text), text.strip())

    def test_empty_raises(self):
        with self.assertRaises(ValidationError) as ctx:
            validate_job_text("")
        self.assertIn("job_text", ctx.exception.detail)

    def test_whitespace_only_raises(self):
        with self.assertRaises(ValidationError):
            validate_job_text("   \n\t  ")

    def test_too_short_raises(self):
        with self.assertRaises(ValidationError) as ctx:
            validate_job_text("Hi there")
        self.assertIn("too short", str(ctx.exception.detail))

    def test_too_long_raises(self):
        with self.assertRaises(ValidationError) as ctx:
            validate_job_text("a" * 16_000)
        self.assertIn("too long", str(ctx.exception.detail))

    def test_non_string_raises(self):
        with self.assertRaises(ValidationError):
            validate_job_text(42)


class TestGoalTextValidator(TestCase):

    def test_valid_goal_stripped(self):
        self.assertEqual(validate_goal_text("  become a backend developer  "),
                         "become a backend developer")

    def test_empty_raises(self):
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
            self.assertEqual(validate_goal_type(gt), gt)

    def test_invalid_goal_type_raises(self):
        with self.assertRaises(ValidationError):
            validate_goal_type("dream_job")


class TestNumericValidators(TestCase):

    def test_valid_days(self):
        self.assertEqual(validate_days_remaining("14"), 14)
        self.assertEqual(validate_days_remaining(30), 30)

    def test_days_zero_raises(self):
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

    def test_hours_zero_raises(self):
        with self.assertRaises(ValidationError):
            validate_study_hours(0)

    def test_hours_over_limit_raises(self):
        with self.assertRaises(ValidationError):
            validate_study_hours(200)


class TestRequirementsListValidator(TestCase):

    def test_valid_list(self):
        items = [{"skill_name": "Python", "category": "language",
                  "importance": "required", "source_excerpt": "Python required"}]
        result = validate_requirements_list(items)
        self.assertEqual(result[0]["skill_name"], "Python")

    def test_empty_list_raises(self):
        with self.assertRaises(ValidationError):
            validate_requirements_list([])

    def test_non_list_raises(self):
        with self.assertRaises(ValidationError):
            validate_requirements_list("not a list")

    def test_missing_skill_name_raises(self):
        with self.assertRaises(ValidationError):
            validate_requirements_list([{"importance": "required"}])

    def test_invalid_importance_raises(self):
        with self.assertRaises(ValidationError):
            validate_requirements_list([{"skill_name": "Python", "importance": "mandatory"}])

    def test_unknown_category_coerced_to_concepts(self):
        items = [{"skill_name": "Python", "importance": "required", "category": "mystery"}]
        result = validate_requirements_list(items)
        self.assertEqual(result[0]["category"], "concepts")

    def test_too_many_items_raises(self):
        items = [{"skill_name": f"Skill{i}", "importance": "required"} for i in range(51)]
        with self.assertRaises(ValidationError):
            validate_requirements_list(items)


# =============================================================================
# Goal mapper — multi-role tests
# =============================================================================

class TestGoalMapper(TestCase):

    def test_backend_goal_maps_to_junior_backend(self):
        result = map_goal_to_profile("I want to become a Junior Backend Developer using Python")
        self.assertEqual(result.profile_id, "prof_junior_backend")
        self.assertIn(result.confidence, ("high", "medium"))
        self.assertGreater(len(result.requirements), 0)
        self.assertIsNone(result.warning)

    def test_frontend_goal_maps_to_frontend_profile(self):
        result = map_goal_to_profile("I want to be a React frontend developer")
        self.assertEqual(result.profile_id, "prof_frontend_developer")
        self.assertGreater(len(result.requirements), 0)

    def test_fullstack_goal_maps_to_fullstack_profile(self):
        result = map_goal_to_profile("I want to become a full stack developer MERN")
        self.assertEqual(result.profile_id, "prof_fullstack_developer")

    def test_data_goal_maps_to_data_analyst(self):
        result = map_goal_to_profile("I want to work as a data analyst using SQL and Power BI")
        self.assertEqual(result.profile_id, "prof_data_analyst")

    def test_ml_goal_maps_to_ml_engineer(self):
        result = map_goal_to_profile("I want to build machine learning models with PyTorch")
        self.assertEqual(result.profile_id, "prof_ml_engineer")

    def test_devops_goal_maps_to_devops_profile(self):
        result = map_goal_to_profile("I want to work in DevOps with Kubernetes and Terraform")
        self.assertEqual(result.profile_id, "prof_devops_engineer")

    def test_mobile_goal_maps_to_mobile_profile(self):
        result = map_goal_to_profile("I want to build mobile apps with React Native")
        self.assertEqual(result.profile_id, "prof_mobile_developer")

    def test_security_goal_maps_to_cybersecurity(self):
        result = map_goal_to_profile("I want to work in cybersecurity and penetration testing")
        self.assertEqual(result.profile_id, "prof_cybersecurity")

    def test_ambiguous_goal_gets_low_confidence_with_warning(self):
        result = map_goal_to_profile("I want a job in technology")
        self.assertEqual(result.confidence, "low")
        self.assertIsNotNone(result.warning)
        self.assertGreater(len(result.requirements), 0)

    def test_very_ambiguous_goal_still_returns_usable_profile(self):
        result = map_goal_to_profile("I want a great career")
        self.assertIsNotNone(result)
        self.assertGreater(len(result.requirements), 0)

    def test_internship_goal_maps_to_backend(self):
        result = map_goal_to_profile("I am looking for a backend internship")
        self.assertEqual(result.profile_id, "prof_junior_backend")

    def test_all_profiles_have_requirements(self):
        """Every profile must return at least 5 requirements."""
        profiles_to_test = [
            "I want to be a backend developer using Django",
            "I want to work as a frontend developer using React",
            "I want to be a full-stack developer",
            "I want to be a data analyst",
            "I want to be a machine learning engineer",
            "I want to work in DevOps",
            "I want to build mobile apps",
            "I want to work in cybersecurity",
        ]
        for goal in profiles_to_test:
            result = map_goal_to_profile(goal)
            self.assertGreaterEqual(len(result.requirements), 5,
                                    f"Profile for '{goal}' has too few requirements")


# =============================================================================
# Rule engine tests
# =============================================================================

class TestRuleEngine(TestCase):

    def test_backend_jd_detects_python_and_django(self):
        from services.openrouter_service import _rule_engine_extract
        result = _rule_engine_extract(
            "We need a Python developer proficient in Django REST Framework and PostgreSQL."
        )
        skill_names = [r["skill_name"] for r in result["requirements"]]
        self.assertIn("Python", skill_names)
        self.assertIn("Django REST Framework", skill_names)
        self.assertIn("PostgreSQL", skill_names)

    def test_frontend_jd_detects_react_typescript(self):
        from services.openrouter_service import _rule_engine_extract
        result = _rule_engine_extract(
            "Looking for a React developer with TypeScript and Tailwind CSS skills."
        )
        skill_names = [r["skill_name"] for r in result["requirements"]]
        self.assertIn("React", skill_names)
        self.assertIn("TypeScript", skill_names)

    def test_ml_jd_detects_pytorch_pandas(self):
        from services.openrouter_service import _rule_engine_extract
        result = _rule_engine_extract(
            "ML Engineer needed. Must know PyTorch, Pandas, and machine learning concepts."
        )
        skill_names = [r["skill_name"] for r in result["requirements"]]
        self.assertIn("PyTorch", skill_names)
        self.assertIn("Pandas", skill_names)
        self.assertIn("Machine Learning", skill_names)

    def test_no_matches_returns_generic_defaults(self):
        from services.openrouter_service import _rule_engine_extract
        result = _rule_engine_extract("Come work with us at an exciting company!")
        self.assertGreater(len(result["requirements"]), 0)
        self.assertEqual(result["extraction_source"], "rule_engine")

    def test_deduplication_no_duplicate_skill_names(self):
        from services.openrouter_service import _rule_engine_extract
        # 'postgres' and 'postgresql' both map to PostgreSQL — should appear once
        result = _rule_engine_extract(
            "We use PostgreSQL (postgres). Also Python and Django."
        )
        skill_names = [r["skill_name"] for r in result["requirements"]]
        self.assertEqual(len(skill_names), len(set(skill_names)),
                         "Duplicate skill names found in rule engine output")


# =============================================================================
# API integration tests
# =============================================================================

BACKEND_JD = (
    "We are seeking a Junior Backend Developer proficient in Python, Django REST Framework, "
    "and PostgreSQL. You will build RESTful APIs, write pytest unit tests, and use Git. "
    "Docker experience is a plus."
)

FRONTEND_JD = (
    "We need a Frontend Developer with strong React and TypeScript skills. "
    "You will build responsive UIs with Tailwind CSS, integrate REST APIs, "
    "write Jest tests, and work with Figma designs."
)

ML_JD = (
    "Machine Learning Engineer role. You will train deep learning models using PyTorch, "
    "perform data analysis with Pandas and NumPy, work with SQL databases, "
    "and deploy models with Docker."
)


class JobAnalysisAPITests(TestCase):

    def setUp(self):
        self.client, self.user = make_client_with_user()
        from apps.job_analysis.views import _rule_engine_extract
        patcher = patch("apps.job_analysis.views.openrouter_service.extract_job_requirements",
                        side_effect=lambda text, **kwargs: _rule_engine_extract(text))
        self.mock_extract = patcher.start()
        self.addCleanup(patcher.stop)

    # ── Normal cases ──────────────────────────────────────────────────────────

    def test_create_backend_jd_returns_201_with_requirements(self):
        resp = self.client.post("/api/job-analyses/",
                                {"job_text": BACKEND_JD}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn("analysis_id", resp.data)
        self.assertIn("requirements", resp.data)
        self.assertIsInstance(resp.data["requirements"], list)
        self.assertGreater(len(resp.data["requirements"]), 0)

    def test_create_frontend_jd_extracts_react(self):
        resp = self.client.post("/api/job-analyses/",
                                {"job_text": FRONTEND_JD}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        skill_names = [r["skill_name"] for r in resp.data["requirements"]]
        self.assertIn("React", skill_names)

    def test_create_ml_jd_extracts_pytorch(self):
        resp = self.client.post("/api/job-analyses/",
                                {"job_text": ML_JD}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        skill_names = [r["skill_name"] for r in resp.data["requirements"]]
        self.assertIn("PyTorch", skill_names)

    def test_analysis_stored_in_database(self):
        self.client.post("/api/job-analyses/",
                         {"job_text": BACKEND_JD}, format="json")
        self.assertEqual(JobAnalysis.objects.count(), 1)
        analysis = JobAnalysis.objects.first()
        self.assertEqual(analysis.mode, "job_specific")
        self.assertGreater(analysis.requirements.count(), 0)

    def test_retrieve_analysis_by_id(self):
        post = self.client.post("/api/job-analyses/",
                                {"job_text": BACKEND_JD}, format="json")
        aid = post.data["analysis_id"]
        resp = self.client.get(f"/api/job-analyses/{aid}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["analysis_id"], aid)

    def test_list_returns_only_current_user_analyses(self):
        # Create analysis for user 1
        self.client.post("/api/job-analyses/",
                         {"job_text": BACKEND_JD}, format="json")
        # Create analysis for user 2
        client2, _ = make_client_with_user()
        client2.post("/api/job-analyses/",
                     {"job_text": FRONTEND_JD}, format="json")

        resp = self.client.get("/api/job-analyses/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)  # only user 1's analysis

    def test_requirements_contain_source_excerpt(self):
        resp = self.client.post("/api/job-analyses/",
                                {"job_text": BACKEND_JD}, format="json")
        for req in resp.data["requirements"]:
            self.assertIn("source_excerpt", req)
            self.assertTrue(len(req["source_excerpt"]) > 0)

    def test_requirements_importance_is_valid(self):
        resp = self.client.post("/api/job-analyses/",
                                {"job_text": BACKEND_JD}, format="json")
        for req in resp.data["requirements"]:
            self.assertIn(req["importance"], ("required", "preferred"))

    # ── Invalid input ─────────────────────────────────────────────────────────

    def test_empty_job_text_rejected(self):
        resp = self.client.post("/api/job-analyses/",
                                {"job_text": ""}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_body_rejected(self):
        resp = self.client.post("/api/job-analyses/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_whitespace_only_rejected(self):
        resp = self.client.post("/api/job-analyses/",
                                {"job_text": "   \n\t  "}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_too_short_rejected(self):
        resp = self.client.post("/api/job-analyses/",
                                {"job_text": "Hire me"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_oversized_jd_rejected(self):
        resp = self.client.post("/api/job-analyses/",
                                {"job_text": "Python developer. " * 1000},
                                format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("too long", str(resp.data))

    def test_invalid_days_remaining_rejected(self):
        resp = self.client.post("/api/job-analyses/",
                                {"job_text": BACKEND_JD, "days_remaining": "not-a-number"},
                                format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_days_remaining_zero_rejected(self):
        resp = self.client.post("/api/job-analyses/",
                                {"job_text": BACKEND_JD, "days_remaining": 0},
                                format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_404_for_nonexistent_analysis(self):
        resp = self.client.get("/api/job-analyses/job_nonexistent/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    # ── Human review (PATCH requirements) ────────────────────────────────────

    def test_confirm_replaces_requirements(self):
        post = self.client.post("/api/job-analyses/",
                                {"job_text": BACKEND_JD}, format="json")
        aid = post.data["analysis_id"]
        patch = self.client.patch(
            f"/api/job-analyses/{aid}/requirements/",
            {"requirements": [
                {"skill_name": "Python", "category": "language",
                 "importance": "required", "source_excerpt": "Confirmed"},
                {"skill_name": "Docker", "category": "devops",
                 "importance": "preferred", "source_excerpt": "Nice to have"},
            ]},
            format="json",
        )
        self.assertEqual(patch.status_code, status.HTTP_200_OK)
        self.assertEqual(Requirement.objects.filter(
            analysis__analysis_id=aid).count(), 2)

    def test_confirm_empty_list_rejected(self):
        post = self.client.post("/api/job-analyses/",
                                {"job_text": BACKEND_JD}, format="json")
        aid = post.data["analysis_id"]
        patch = self.client.patch(
            f"/api/job-analyses/{aid}/requirements/",
            {"requirements": []}, format="json")
        self.assertEqual(patch.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_missing_requirements_key_rejected(self):
        post = self.client.post("/api/job-analyses/",
                                {"job_text": BACKEND_JD}, format="json")
        aid = post.data["analysis_id"]
        patch = self.client.patch(
            f"/api/job-analyses/{aid}/requirements/", {}, format="json")
        self.assertEqual(patch.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_invalid_importance_rejected(self):
        post = self.client.post("/api/job-analyses/",
                                {"job_text": BACKEND_JD}, format="json")
        aid = post.data["analysis_id"]
        patch = self.client.patch(
            f"/api/job-analyses/{aid}/requirements/",
            {"requirements": [{"skill_name": "Python", "importance": "mandatory"}]},
            format="json")
        self.assertEqual(patch.status_code, status.HTTP_400_BAD_REQUEST)

    # ── OpenRouter failure / malformed AI output ──────────────────────────────

    @patch("apps.job_analysis.views.openrouter_service")
    def test_malformed_llm_output_falls_back_to_rule_engine(self, mock_svc):
        """LLM returns empty requirements → rule engine kicks in → still 201."""
        mock_svc.extract_job_requirements.return_value = {
            "role_title": "Unknown",
            "summary": "",
            "requirements": [],
            "extraction_source": "openrouter",
        }
        resp = self.client.post("/api/job-analyses/",
                                {"job_text": BACKEND_JD}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertGreater(len(resp.data["requirements"]), 0)

    @patch("apps.job_analysis.views.openrouter_service")
    def test_openrouter_exception_falls_back_gracefully(self, mock_svc):
        """OpenRouter raises an exception → rule engine → 201."""
        mock_svc.extract_job_requirements.side_effect = RuntimeError("connection timeout")
        resp = self.client.post("/api/job-analyses/",
                                {"job_text": BACKEND_JD}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn("analysis_id", resp.data)

    @patch("apps.job_analysis.views.openrouter_service")
    def test_llm_json_parse_failure_falls_back(self, mock_svc):
        """LLM returns non-JSON garbage → rule engine fallback."""
        mock_svc.extract_job_requirements.return_value = {
            "role_title": "",
            "summary": "",
            "requirements": [],
            "extraction_source": "openrouter",
        }
        resp = self.client.post("/api/job-analyses/",
                                {"job_text": FRONTEND_JD}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_openrouter_health_check_structure(self):
        health = openrouter_service.health_check()
        self.assertIn("openrouter", health)
        self.assertIn("rule_engine", health)
        self.assertTrue(health["rule_engine"]["available"])

    # ── Skill profiles list endpoint ──────────────────────────────────────────

    def test_profiles_list_returns_all_profiles(self):
        resp = self.client.get("/api/skill-profiles/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsInstance(resp.data, list)
        self.assertGreaterEqual(len(resp.data), 6)

    def test_profiles_list_contains_required_fields(self):
        resp = self.client.get("/api/skill-profiles/")
        for profile in resp.data:
            self.assertIn("profile_id", profile)
            self.assertIn("role_title", profile)
            self.assertIn("description", profile)


# =============================================================================
# Goals API tests
# =============================================================================

class GoalAPITests(TestCase):

    def setUp(self):
        self.client, self.user = make_client_with_user()

    def test_create_backend_goal(self):
        resp = self.client.post("/api/goals/", {
            "goal_text": "I want to become a Junior Backend Developer using Python",
            "goal_type": "career_role",
            "days_remaining": 30,
            "study_hours_per_week": 10.0,
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn("goal", resp.data)
        self.assertIn("requirements", resp.data)
        self.assertIn("profile_id", resp.data)
        self.assertIn("role_title", resp.data)
        self.assertEqual(resp.data["profile_id"], "prof_junior_backend")
        self.assertGreater(len(resp.data["requirements"]), 0)

    def test_create_frontend_goal_maps_correctly(self):
        resp = self.client.post("/api/goals/", {
            "goal_text": "I want to become a frontend developer using React",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["profile_id"], "prof_frontend_developer")

    def test_create_ml_goal_maps_correctly(self):
        resp = self.client.post("/api/goals/", {
            "goal_text": "I want to work in machine learning with PyTorch",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["profile_id"], "prof_ml_engineer")

    def test_create_devops_goal_maps_correctly(self):
        resp = self.client.post("/api/goals/", {
            "goal_text": "I want to work in DevOps with Kubernetes and CI/CD",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["profile_id"], "prof_devops_engineer")

    def test_goal_saved_to_database(self):
        self.client.post("/api/goals/", {
            "goal_text": "I want to learn Django and build REST APIs",
            "goal_type": "skill_goal",
        }, format="json")
        self.assertEqual(Goal.objects.count(), 1)
        goal = Goal.objects.first()
        self.assertEqual(goal.target_profile_id, "prof_junior_backend")

    def test_reject_empty_goal_text(self):
        resp = self.client.post("/api/goals/",
                                {"goal_text": "", "goal_type": "career_role"},
                                format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_whitespace_only_goal(self):
        resp = self.client.post("/api/goals/",
                                {"goal_text": "   "}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_invalid_goal_type(self):
        resp = self.client.post("/api/goals/",
                                {"goal_text": "I want to learn Python",
                                 "goal_type": "dream_job"},
                                format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ambiguous_goal_returns_201_with_warning(self):
        resp = self.client.post("/api/goals/", {
            "goal_text": "I want a great career in technology",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(resp.data.get("warning"))
        self.assertEqual(resp.data.get("confidence"), "low")
        self.assertGreater(len(resp.data["requirements"]), 0)

    def test_list_goals_for_authenticated_user(self):
        self.client.post("/api/goals/",
                         {"goal_text": "I want to be a backend developer"},
                         format="json")
        # Other user's goal — must NOT appear in this user's list
        client2, _ = make_client_with_user()
        client2.post("/api/goals/",
                     {"goal_text": "I want to work in data analysis"},
                     format="json")

        resp = self.client.get("/api/goals/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)

    def test_goal_type_defaults_to_career_role(self):
        resp = self.client.post("/api/goals/",
                                {"goal_text": "I want to become a backend developer"},
                                format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["goal"]["goal_type"], "career_role")

    def test_confidence_high_for_specific_goal(self):
        resp = self.client.post("/api/goals/", {
            "goal_text": "I want to be a DevOps engineer with Kubernetes, Terraform, and CI/CD",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data.get("confidence"), "high")

    def test_response_requirements_have_valid_importance(self):
        resp = self.client.post("/api/goals/", {
            "goal_text": "I want to become a backend developer",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        for req in resp.data["requirements"]:
            self.assertIn(req["importance"], ("required", "preferred"))


# Import needed for health check test
from services.openrouter_service import openrouter_service  # noqa: E402
