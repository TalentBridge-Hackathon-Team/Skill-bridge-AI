from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

class AssessmentTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_get_assessment_task(self):
        response = self.client.get('/api/assessments/asm_api_testing_01/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['task_id'], 'asm_api_testing_01')

    def test_submit_assessment(self):
        payload = {
            "submission": {
                "valid_test": "POST /api/orders Expect 201",
                "invalid_test": "POST /api/orders without body Expect 400"
            }
        }
        response = self.client.post('/api/assessments/asm_api_testing_01/submissions/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
