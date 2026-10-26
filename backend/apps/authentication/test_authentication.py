"""
SkillBridge AI — Authentication Tests
Covers: register, login, logout, token refresh, protected endpoint access.

Run with:
    cd backend
    pytest apps/authentication/test_authentication.py -v
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient


class RegisterTests(TestCase):

    def setUp(self):
        self.client = APIClient()

    def test_register_valid_user_returns_201_with_tokens(self):
        response = self.client.post("/api/auth/register/", {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            "full_name": "New User",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["username"], "newuser")

    def test_register_creates_user_in_database(self):
        self.client.post("/api/auth/register/", {
            "username": "dbuser",
            "email": "dbuser@example.com",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
        }, format="json")
        self.assertTrue(User.objects.filter(username="dbuser").exists())

    def test_register_duplicate_username_rejected(self):
        User.objects.create_user(username="taken", email="a@b.com", password="pass")
        response = self.client.post("/api/auth/register/", {
            "username": "taken",
            "email": "other@example.com",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

    def test_register_duplicate_email_rejected(self):
        User.objects.create_user(username="user1", email="taken@example.com", password="pass")
        response = self.client.post("/api/auth/register/", {
            "username": "user2",
            "email": "taken@example.com",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_register_passwords_mismatch_rejected(self):
        response = self.client.post("/api/auth/register/", {
            "username": "mismatch",
            "email": "mismatch@example.com",
            "password": "StrongPass123!",
            "password_confirm": "WrongPass456!",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_short_password_rejected(self):
        response = self.client.post("/api/auth/register/", {
            "username": "shortpw",
            "email": "shortpw@example.com",
            "password": "abc",
            "password_confirm": "abc",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_email_rejected(self):
        response = self.client.post("/api/auth/register/", {
            "username": "noemail",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_empty_body_rejected(self):
        response = self.client.post("/api/auth/register/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="loginuser",
            email="loginuser@example.com",
            password="StrongPass123!",
        )

    def test_login_valid_credentials_returns_200_with_tokens(self):
        response = self.client.post("/api/auth/login/", {
            "username": "loginuser",
            "password": "StrongPass123!",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIn("user", response.data)

    def test_login_wrong_password_rejected(self):
        response = self.client.post("/api/auth/login/", {
            "username": "loginuser",
            "password": "WrongPassword!",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_wrong_username_rejected(self):
        response = self.client.post("/api/auth/login/", {
            "username": "doesnotexist",
            "password": "StrongPass123!",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_missing_password_rejected(self):
        response = self.client.post("/api/auth/login/", {
            "username": "loginuser",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_empty_body_rejected(self):
        response = self.client.post("/api/auth/login/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_inactive_user_rejected(self):
        self.user.is_active = False
        self.user.save()
        response = self.client.post("/api/auth/login/", {
            "username": "loginuser",
            "password": "StrongPass123!",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LogoutTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="logoutuser",
            email="logout@example.com",
            password="StrongPass123!",
        )

    def _login(self):
        resp = self.client.post("/api/auth/login/", {
            "username": "logoutuser",
            "password": "StrongPass123!",
        }, format="json")
        return resp.data["access"], resp.data["refresh"]

    def test_logout_valid_refresh_token_returns_200(self):
        access, refresh = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.post("/api/auth/logout/", {"refresh": refresh}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)

    def test_logout_without_auth_header_rejected(self):
        _, refresh = self._login()
        # No credentials set — should get 401
        self.client.credentials()
        response = self.client.post("/api/auth/logout/", {"refresh": refresh}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_missing_refresh_token_rejected(self):
        access, _ = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class MeViewTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="meuser",
            email="me@example.com",
            password="StrongPass123!",
            first_name="Me",
            last_name="User",
        )

    def _get_access_token(self):
        resp = self.client.post("/api/auth/login/", {
            "username": "meuser",
            "password": "StrongPass123!",
        }, format="json")
        return resp.data["access"]

    def test_me_with_valid_token_returns_user(self):
        token = self._get_access_token()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "meuser")
        self.assertEqual(response.data["email"], "me@example.com")

    def test_me_without_token_returns_401(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_with_invalid_token_returns_401(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not.a.real.token")
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ProtectedEndpointTests(TestCase):
    """
    Verify that existing API endpoints now require authentication.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="authtest",
            email="authtest@example.com",
            password="StrongPass123!",
        )

    def _get_access_token(self):
        resp = self.client.post("/api/auth/login/", {
            "username": "authtest",
            "password": "StrongPass123!",
        }, format="json")
        return resp.data["access"]

    def test_job_analyses_without_token_returns_401(self):
        response = self.client.get("/api/job-analyses/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_job_analyses_with_token_returns_200(self):
        token = self._get_access_token()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get("/api/job-analyses/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_goals_without_token_returns_401(self):
        response = self.client.get("/api/goals/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_goals_with_token_returns_200(self):
        token = self._get_access_token()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get("/api/goals/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
