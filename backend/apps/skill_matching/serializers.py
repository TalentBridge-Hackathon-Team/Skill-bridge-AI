from rest_framework import serializers
from .models import MatchReport

class MatchReportSerializer(serializers.ModelSerializer):
    source_excerpt = serializers.CharField(source='requirement.source_excerpt', read_only=True)

    class Meta:
        model = MatchReport
        fields = [
            'report_id', 'skill_name', 'category', 'importance', 'status',
            'reason', 'priority', 'recommended_action', 'task_type',
            'source_excerpt', 'created_at'
        ]
