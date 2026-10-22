from rest_framework import serializers
from .models import AssessmentTask, AssessmentSubmission

class AssessmentTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssessmentTask
        fields = ['task_id', 'title', 'task_type', 'target_skill', 'total_points', 'instructions', 'rubric']

class AssessmentSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssessmentSubmission
        fields = ['submission_id', 'task_id', 'user_id', 'task_type', 'submission_data', 'score', 'max_score', 'feedback', 'status', 'submitted_at']
