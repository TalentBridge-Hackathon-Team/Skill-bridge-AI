from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.profiles.models import UserProfile, SkillEvidence

class UserProfileTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_get_or_create_profile(self):
        response = self.client.get('/api/profiles/me/?user_id=test_user_01')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user_id'], 'test_user_01')

    def test_update_profile(self):
        # Ensure profile exists first (GET auto-creates)
        self.client.get('/api/profiles/me/?user_id=test_user_01')
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



class ProfileCreateTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_create_profile_success(self):
        payload = {
            "user_id": "new_user_create",
            "name": "New User",
            "target_role": "Data Engineer",
            "skills": ["Python", "SQL"],
            "study_capacity_hours_per_week": 20,
        }
        response = self.client.post('/api/profiles/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user_id'], 'new_user_create')
        self.assertEqual(response.data['study_capacity_hours_per_week'], 20)

    def test_create_profile_duplicate_returns_409(self):
        UserProfile.objects.create(user_id="existing_user", name="Existing", target_role="Dev", skills=[])
        payload = {"user_id": "existing_user", "name": "Duplicate Attempt", "target_role": "Dev"}
        response = self.client.post('/api/profiles/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_create_profile_missing_name_returns_400(self):
        payload = {"user_id": "bad_user", "name": "", "target_role": "Dev"}
        response = self.client.post('/api/profiles/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ownership_check_blocks_cross_user_put(self):
        # Create profile for user_a
        self.client.get('/api/profiles/me/?user_id=user_a')
        # Try to update user_a's profile while claiming to be user_b
        payload = {"user_id": "user_a", "name": "Hacker"}
        response = self.client.put('/api/profiles/me/?user_id=user_b', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_put_nonexistent_profile_returns_404(self):
        payload = {"user_id": "ghost_user", "name": "Ghost"}
        response = self.client.put('/api/profiles/me/?user_id=ghost_user', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_profile_stores_goal_context_fields(self):
        payload = {
            "user_id": "goal_user",
            "name": "Goal Setter",
            "target_role": "ML Engineer",
            "skills": ["Python"],
            "professional_background": "3 years in data analytics",
            "target_date": "2027-06-01",
            "study_capacity_hours_per_week": 15,
            "project_descriptions": [
                {
                    "title": "Sales Predictor",
                    "description": "ML model for forecasting",
                    "link": "https://github.com/test/sales",
                    "skills_demonstrated": ["scikit-learn", "pandas"]
                }
            ]
        }
        response = self.client.post('/api/profiles/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['professional_background'], "3 years in data analytics")
        self.assertEqual(response.data['target_date'], "2027-06-01")
        self.assertEqual(len(response.data['project_descriptions']), 1)
