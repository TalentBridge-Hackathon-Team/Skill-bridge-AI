from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from .models import UserProfile, SkillEvidence

class UserProfileTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_get_or_create_profile(self):
        response = self.client.get('/api/profiles/me/?user_id=test_user_01')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user_id'], 'test_user_01')

    def test_update_profile(self):
        payload = {
            "user_id": "test_user_01",
            "name": "Alex Candidate",
            "target_role": "Junior Backend Developer",
            "skills": ["Python", "SQL"]
        }
        response = self.client.put('/api/profiles/me/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], "Alex Candidate")

    def test_upload_resume_triggers_s3_and_sqs(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        sample_cv = SimpleUploadedFile("alex_resume.pdf", b"Alex Candidate Python CV", content_type="application/pdf")
        response = self.client.post(
            '/api/profiles/me/resume/',
            {"user_id": "test_candidate_unit", "file": sample_cv},
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['s3']['success'])
        self.assertIn("resumes/test_candidate_unit/alex_resume.pdf", response.data['s3']['key'])
        if response.data.get('sqs'):
            self.assertTrue(response.data['sqs']['success'])

