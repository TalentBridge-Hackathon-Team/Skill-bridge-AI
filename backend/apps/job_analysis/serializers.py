"""
SkillBridge AI — Job Analysis Serializers
DRF ModelSerializers for the Job & Goal Analysis module (Member 2).
"""

from rest_framework import serializers
from .models import JobAnalysis, Requirement, Goal


class RequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Requirement
        fields = [
            "requirement_id",
            "skill_name",
            "category",
            "importance",
            "source_excerpt",
            "user_confirmed",
        ]


class JobAnalysisSerializer(serializers.ModelSerializer):
    requirements = RequirementSerializer(many=True, read_only=True)

    class Meta:
        model = JobAnalysis
        fields = [
            "analysis_id",
            "user_id",
            "mode",
            "role_title",
            "job_text",
            "job_image",
            "days_remaining",
            "study_hours_per_week",
            "summary",
            "status",
            "requirements",
            "created_at",
        ]


class GoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = [
            "goal_id",
            "user_id",
            "goal_type",
            "goal_text",
            "target_profile_id",
            "days_remaining",
            "study_hours_per_week",
            "created_at",
        ]


class GoalAnalysisResponseSerializer(serializers.Serializer):
    """
    Response shape for POST /api/goals/ — extends the basic Goal fields with
    the mapped profile requirements and any confidence warning.
    This is used for documentation / validation purposes in the view.
    It is a plain Serializer (not ModelSerializer) because it combines
    multiple sources.
    """

    goal = GoalSerializer()
    profile_id = serializers.CharField()
    role_title = serializers.CharField()
    confidence = serializers.ChoiceField(choices=["high", "medium", "low"])
    warning = serializers.CharField(allow_null=True, required=False)
    requirements = RequirementSerializer(many=True)
