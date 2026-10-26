from rest_framework import serializers
from .models import AssessmentTask, AssessmentSubmission, MicroLessonProgress

class AssessmentTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssessmentTask
        fields = ['task_id', 'title', 'task_type', 'target_skill', 'total_points', 'instructions', 'rubric']

class AssessmentSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssessmentSubmission
        fields = ['submission_id', 'task_id', 'user_id', 'task_type', 'submission_data', 'score', 'max_score', 'feedback', 'status', 'submitted_at']

class MicroLessonProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = MicroLessonProgress
        fields = [
            'id', 'user_id', 'skill_name', 'unlocked_hint_level',
            'chat_history', 'learning_preference', 'experience_level',
            'struggle_topics', 'created_at', 'updated_at'
        ]
