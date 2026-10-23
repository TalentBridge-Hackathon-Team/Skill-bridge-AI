"""
SkillBridge AI — Authentication Serializers
Handles register, login request/response validation.
Uses Django's built-in User model — no custom model needed.
"""

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken


class RegisterSerializer(serializers.Serializer):
    """Validates registration input and creates a new User."""

    username = serializers.CharField(
        min_length=3,
        max_length=150,
        error_messages={
            "min_length": "Username must be at least 3 characters.",
            "max_length": "Username cannot exceed 150 characters.",
            "required": "Username is required.",
            "blank": "Username cannot be blank.",
        },
    )
    email = serializers.EmailField(
        error_messages={
            "required": "Email is required.",
            "invalid": "Enter a valid email address.",
        }
    )
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        error_messages={
            "min_length": "Password must be at least 8 characters.",
            "required": "Password is required.",
        },
    )
    password_confirm = serializers.CharField(
        write_only=True,
        error_messages={"required": "Please confirm your password."},
    )
    # Optional — used to link the Django User to the SkillBridge UserProfile
    full_name = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=200,
        default="",
    )

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                "This username is already taken. Please choose another."
            )
        return value.strip()

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )
        return value.lower().strip()

    def validate(self, data):
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )
        # Run Django's built-in password strength validators
        try:
            validate_password(data["password"])
        except Exception as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return data

    def create(self, validated_data):
        full_name = validated_data.pop("full_name", "")
        validated_data.pop("password_confirm")

        first_name, _, last_name = full_name.partition(" ")

        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=first_name.strip(),
            last_name=last_name.strip(),
        )
        return user


class LoginSerializer(serializers.Serializer):
    """Validates login credentials and returns the authenticated User."""

    username = serializers.CharField(
        error_messages={"required": "Username is required.", "blank": "Username cannot be blank."}
    )
    password = serializers.CharField(
        write_only=True,
        error_messages={"required": "Password is required."},
    )

    def validate(self, data):
        username = data.get("username", "").strip()
        password = data.get("password", "")

        if not username or not password:
            raise serializers.ValidationError(
                {"detail": "Username and password are required."}
            )

        # authenticate() checks both username and hashed password
        user = authenticate(username=username, password=password)

        if user is None:
            raise serializers.ValidationError(
                {"detail": "Incorrect username or password."}
            )

        if not user.is_active:
            raise serializers.ValidationError(
                {"detail": "This account has been deactivated."}
            )

        data["user"] = user
        return data


class UserSerializer(serializers.ModelSerializer):
    """Read-only representation of the authenticated user."""

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "full_name", "date_joined"]
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class TokenResponseSerializer(serializers.Serializer):
    """Shape of the token pair returned on login/register."""

    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()
