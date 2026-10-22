from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.job_analysis.models import JobAnalysis

class SkillMatchingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.analysis = JobAnalysis.objects.create(
            analysis_id="job_test_01",
            user_id="test_user",
            role_title="Backend Intern",
            job_text="Python and SQL required"
        )

    def test_run_matching_on_analysis(self):
        response = self.client.post(f'/api/job-analyses/{self.analysis.analysis_id}/match/', format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['analysis_id'], self.analysis.analysis_id)
