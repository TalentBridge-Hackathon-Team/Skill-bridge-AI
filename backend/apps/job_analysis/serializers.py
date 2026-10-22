from rest_framework import serializers
from .models import JobAnalysis, Requirement, Goal

class RequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Requirement
        fields = ['requirement_id', 'skill_name', 'category', 'importance', 'source_excerpt', 'user_confirmed']

class JobAnalysisSerializer(serializers.ModelSerializer):
    requirements = RequirementSerializer(many=True, read_only=True)

    class Meta:
        model = JobAnalysis
        fields = [
            'analysis_id', 'user_id', 'mode', 'role_title', 'job_text',
            'job_image', 'days_remaining', 'study_hours_per_week',
            'summary', 'status', 'requirements', 'created_at'
        ]

class GoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = [
            'goal_id', 'user_id', 'goal_type', 'goal_text',
            'target_profile_id', 'days_remaining', 'study_hours_per_week', 'created_at'
        ]
