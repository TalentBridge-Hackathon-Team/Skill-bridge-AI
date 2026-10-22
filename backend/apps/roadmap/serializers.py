from rest_framework import serializers
from .models import RoadmapTask, ApplicationChecklist

class RoadmapTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoadmapTask
        fields = [
            'task_id', 'user_id', 'requirement_id', 'title', 'description',
            'target_skill', 'task_type', 'priority', 'status',
            'action_deliverable', 'completion_definition', 'effort_hours_estimate',
            'expected_evidence', 'due_date', 'milestone', 'curated_resources',
            'created_at', 'completed_at'
        ]

class ApplicationChecklistSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationChecklist
        fields = ['item_id', 'user_id', 'title', 'description', 'completed', 'category']
