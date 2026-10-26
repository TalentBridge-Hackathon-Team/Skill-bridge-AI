"""
SkillBridge AI — Authentication Views

Endpoints:
  POST /api/auth/register/   — create account, returns JWT pair
  POST /api/auth/login/      — login, returns JWT pair
  POST /api/auth/logout/     — blacklist refresh token (invalidate session)
  POST /api/auth/refresh/    — swap refresh token for a new access token
  GET  /api/auth/me/         — return the currently authenticated user

All auth endpoints are public (AllowAny) — they don't require an existing token.
The /me/ endpoint requires a valid access token.
"""

import logging

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import LoginSerializer, RegisterSerializer, UserSerializer

logger = logging.getLogger(__name__)


def _make_token_response(user: User) -> dict:
    """
    Generates a JWT access + refresh pair for the given user and returns
    a dict ready to send as a response body.
    """
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSerializer(user).data,
    }


class RegisterView(APIView):
    """
    POST /api/auth/register/
    Creates a new user account and returns a JWT token pair.
    Also auto-creates a SkillBridge UserProfile for the new user.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()

        # Auto-provision a SkillBridge UserProfile so other modules work immediately
        try:
            from apps.profiles.models import UserProfile  # noqa: PLC0415

            full_name = f"{user.first_name} {user.last_name}".strip() or user.username
            UserProfile.objects.get_or_create(
                user_id=str(user.id),
                defaults={
                    "name": full_name,
                    "target_role": "Junior Backend Developer",
                    "experience_level": "Entry Level",
                    "skills": [],
                },
            )
        except Exception as exc:  # noqa: BLE001
            # Profile creation failure must not block registration
            logger.warning("Could not auto-create UserProfile for user %s: %s", user.id, exc)

        logger.info("New user registered: %s (id=%s)", user.username, user.id)
        return Response(_make_token_response(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    POST /api/auth/login/
    Authenticates credentials and returns a JWT token pair.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data["user"]
        logger.info("User logged in: %s (id=%s)", user.username, user.id)
        return Response(_make_token_response(user), status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blacklists the submitted refresh token so it can no longer be used.
    The access token expires naturally after its configured lifetime (60 min).

    Request body:
        { "refresh": "<refresh_token_string>" }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"error": "Refresh token is required to log out."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            logger.info("User %s logged out; refresh token blacklisted.", request.user.id)
            return Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)
        except TokenError as exc:
            return Response(
                {"error": f"Invalid or expired refresh token: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )


class TokenRefreshView(APIView):
    """
    POST /api/auth/refresh/
    Accepts a refresh token and returns a new access token.
    Delegates to simplejwt's built-in view logic.

    Request body:
        { "refresh": "<refresh_token_string>" }

    Response:
        { "access": "<new_access_token>" }
        (plus a new "refresh" if ROTATE_REFRESH_TOKENS = True)
    """

    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"error": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            data = {"access": str(token.access_token)}

            # If token rotation is on, also return the new refresh token
            from django.conf import settings as django_settings  # noqa: PLC0415

            if getattr(django_settings, "SIMPLE_JWT", {}).get("ROTATE_REFRESH_TOKENS", False):
                token.blacklist()
                new_refresh = RefreshToken.for_user(
                    User.objects.get(id=token["user_id"])
                )
                data["refresh"] = str(new_refresh)

            return Response(data, status=status.HTTP_200_OK)
        except TokenError as exc:
            return Response(
                {"error": f"Token is invalid or expired: {exc}"},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class MeView(APIView):
    """
    GET /api/auth/me/
    Returns the profile of the currently authenticated user.
    Requires a valid Bearer access token in the Authorization header.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)
