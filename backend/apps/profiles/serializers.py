from rest_framework import serializers
from .models import UserProfile, SkillEvidence


class SkillEvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillEvidence
        fields = [
            'evidence_id', 'skill_name', 'evidence_type',
            'title', 'reference', 'description', 'review_status', 'created_at'
        ]


class ProjectDescriptionSerializer(serializers.Serializer):
    """Validates individual project entries stored in the JSONField."""
    project_id = serializers.CharField(max_length=100, required=False)
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(allow_blank=True, required=False)
    link = serializers.URLField(allow_blank=True, required=False)
    skills_demonstrated = serializers.ListField(
        child=serializers.CharField(max_length=100), required=False, default=list
    )


class UserProfileSerializer(serializers.ModelSerializer):
    evidence = SkillEvidenceSerializer(source='evidence_records', many=True, read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'user_id', 'name', 'target_role', 'education', 'experience_level',
            'skills', 'professional_background', 'project_descriptions',
            'target_date', 'study_capacity_hours_per_week',
            'resume_file', 'resume_parsed_text', 'evidence', 'updated_at',
        ]
        read_only_fields = ['updated_at']

    def validate_skills(self, value):
        """Accept either a comma-separated string or a list."""
        if isinstance(value, str):
            return [s.strip() for s in value.split(',') if s.strip()]
        if isinstance(value, list):
            return value
        raise serializers.ValidationError("skills must be a list or comma-separated string.")

    def validate_project_descriptions(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("project_descriptions must be a list.")
        for item in value:
            s = ProjectDescriptionSerializer(data=item)
            if not s.is_valid():
                raise serializers.ValidationError(s.errors)
        return value

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Name cannot be empty.")
        return value.strip()

    def validate_target_role(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Target role cannot be empty.")
        return value.strip()
