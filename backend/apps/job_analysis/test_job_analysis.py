from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

class JobAnalysisTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_reject_empty_job_text(self):
        # Blueprint Acceptance Criteria: empty job description is rejected
        response = self.client.post('/api/job-analyses/', {"job_text": ""}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_submit_valid_job_text(self):
        payload = {
            "job_text": "We need a Junior Backend Developer proficient in Python, REST APIs, and SQL.",
            "role_title": "Junior Backend Developer"
        }
        response = self.client.post('/api/job-analyses/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("analysis_id", response.data)
