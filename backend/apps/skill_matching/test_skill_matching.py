from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.job_analysis.models import JobAnalysis, Requirement
from apps.profiles.models import UserProfile, SkillEvidence
from apps.assessments.models import AssessmentTask, AssessmentSubmission
from services.matching_engine import SkillMatchingEngine


class SkillMatchingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_id = "test_learner_01"

        # Create Profile for Member 1
        self.profile = UserProfile.objects.create(
            user_id=self.user_id,
            name="Test Learner",
            target_role="Junior Backend Developer",
            skills=["Python", "PostgreSQL", "Git"]
        )

        # Create Job Analysis for Member 2
        self.analysis = JobAnalysis.objects.create(
            analysis_id="job_test_01",
            user_id=self.user_id,
            role_title="Backend Intern",
            job_text="Python, Django REST Framework, and PostgreSQL required",
            days_remaining=14,
            study_hours_per_week=14.0
        )

        # Create Requirements
        self.req_python = Requirement.objects.create(
            requirement_id="req_py_01",
            analysis=self.analysis,
            skill_name="Python",
            category="language",
            importance="required",
            source_excerpt="Strong proficiency in Python"
        )
        self.req_drf = Requirement.objects.create(
            requirement_id="req_drf_01",
            analysis=self.analysis,
            skill_name="Django REST Framework",
            category="framework",
            importance="required",
            source_excerpt="Experience building APIs with Django REST Framework"
        )
        self.req_pg = Requirement.objects.create(
            requirement_id="req_pg_01",
            analysis=self.analysis,
            skill_name="PostgreSQL",
            category="database",
            importance="required",
            source_excerpt="Relational database queries with PostgreSQL"
        )
        self.req_docker = Requirement.objects.create(
            requirement_id="req_docker_01",
            analysis=self.analysis,
            skill_name="Docker",
            category="devops",
            importance="preferred",
            source_excerpt="Containerization experience is a plus"
        )

    def test_run_matching_on_analysis(self):
        response = self.client.post(
            f'/api/job-analyses/{self.analysis.analysis_id}/match/?user_id={self.user_id}',
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['analysis_id'], self.analysis.analysis_id)
        self.assertIn('results', response.data)
        self.assertIn('summary', response.data)
        self.assertIn('feasibility', response.data)
        self.assertEqual(len(response.data['results']), 4)

    def test_verified_evidence_yields_demonstrated_status(self):
        # Create verified evidence item
        SkillEvidence.objects.create(
            evidence_id="evi_drf_01",
            profile=self.profile,
            skill_name="Django REST Framework",
            title="E-Commerce API Service",
            reference="https://github.com/test/ecommerce-api",
            review_status="verified",
            evidence_type="project"
        )

        response = self.client.post(
            f'/api/job-analyses/{self.analysis.analysis_id}/match/?user_id={self.user_id}',
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        drf_result = next(r for r in response.data['results'] if r['skill_name'] == 'Django REST Framework')
        self.assertEqual(drf_result['status'], 'Demonstrated')
        self.assertEqual(drf_result['priority'], 'Low')
        self.assertEqual(drf_result['effort_hours_estimate'], 0.0)
        self.assertTrue(len(drf_result['supporting_evidence']) > 0)
        self.assertEqual(drf_result['supporting_evidence'][0]['title'], 'E-Commerce API Service')

    def test_self_reported_skill_without_evidence(self):
        # PostgreSQL is in profile.skills, but no verified evidence attached
        response = self.client.post(
            f'/api/job-analyses/{self.analysis.analysis_id}/match/?user_id={self.user_id}',
            format='json'
        )
        pg_result = next(r for r in response.data['results'] if r['skill_name'] == 'PostgreSQL')
        self.assertEqual(pg_result['status'], 'Self-reported')
        self.assertEqual(pg_result['priority'], 'High')
        self.assertEqual(pg_result['effort_hours_estimate'], 8.0)

    def test_unverified_skill_when_not_claimed(self):
        # Docker is preferred and not in profile.skills
        response = self.client.post(
            f'/api/job-analyses/{self.analysis.analysis_id}/match/?user_id={self.user_id}',
            format='json'
        )
        docker_result = next(r for r in response.data['results'] if r['skill_name'] == 'Docker')
        self.assertEqual(docker_result['status'], 'Unverified')
        self.assertEqual(docker_result['effort_hours_estimate'], 8.4)
        self.assertIn('effort_breakdown', docker_result)
        self.assertEqual(docker_result['effort_breakdown']['complexity_multiplier'], 1.4)

    def test_assessment_submission_integration(self):
        # Create Assessment Task & Submission (Member 4 integration)
        task = AssessmentTask.objects.create(
            task_id="task_api_01",
            title="REST API Test Assessment",
            target_skill="Django REST Framework",
            total_points=10
        )
        AssessmentSubmission.objects.create(
            submission_id="sub_01",
            task=task,
            user_id=self.user_id,
            score=9,
            max_score=10,
            status="passed"
        )

        response = self.client.post(
            f'/api/job-analyses/{self.analysis.analysis_id}/match/?user_id={self.user_id}',
            format='json'
        )
        drf_result = next(r for r in response.data['results'] if r['skill_name'] == 'Django REST Framework')
        self.assertEqual(drf_result['status'], 'Demonstrated')
        self.assertIn('assessment score of 9/10', drf_result['reason'])

    def test_cosine_similarity_calculation(self):
        # Vector mathematics unit test
        vec_a = [1.0, 0.0, 0.0]
        vec_b = [1.0, 0.0, 0.0]
        sim_identical = SkillMatchingEngine.calculate_cosine_similarity(vec_a, vec_b)
        self.assertEqual(sim_identical, 1.0)

        vec_c = [0.0, 1.0, 0.0]
        sim_orthogonal = SkillMatchingEngine.calculate_cosine_similarity(vec_a, vec_c)
        self.assertEqual(sim_orthogonal, 0.0)

        # Zero vector handling
        self.assertEqual(SkillMatchingEngine.calculate_cosine_similarity([0.0, 0.0], [1.0, 1.0]), 0.0)
        self.assertEqual(SkillMatchingEngine.calculate_cosine_similarity(None, [1.0]), 0.0)

    def test_gaps_endpoint(self):
        # Match first to populate MatchReport
        self.client.post(f'/api/job-analyses/{self.analysis.analysis_id}/match/?user_id={self.user_id}')

        response = self.client.get(f'/api/job-analyses/{self.analysis.analysis_id}/gaps/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['analysis_id'], self.analysis.analysis_id)
        self.assertIn('summary', response.data)
        self.assertIn('results', response.data)
        self.assertIn('feasibility', response.data)
        self.assertEqual(len(response.data['results']), 4)
