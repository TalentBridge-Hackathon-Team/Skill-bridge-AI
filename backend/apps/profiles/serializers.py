from rest_framework import serializers
from .models import UserProfile, SkillEvidence

class SkillEvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillEvidence
        fields = ['evidence_id', 'skill_name', 'evidence_type', 'title', 'reference', 'description', 'review_status', 'created_at']

class UserProfileSerializer(serializers.ModelSerializer):
    evidence = SkillEvidenceSerializer(source='evidence_records', many=True, read_only=True)

    class Meta:
        model = UserProfile
        fields = ['user_id', 'name', 'target_role', 'education', 'experience_level', 'skills', 'resume_file', 'resume_parsed_text', 'evidence', 'updated_at']
