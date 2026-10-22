from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

class RoadmapTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_get_roadmap(self):
        response = self.client.get('/api/roadmap/?user_id=test_user')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tasks', response.data)
