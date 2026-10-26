from rest_framework import serializers
from .models import MatchReport

class MatchReportSerializer(serializers.ModelSerializer):
    source_excerpt = serializers.CharField(source='requirement.source_excerpt', read_only=True)
    skill = serializers.CharField(source='skill_name', read_only=True)
    action = serializers.CharField(source='recommended_action', read_only=True)
    supporting_evidence = serializers.SerializerMethodField()

    effort_breakdown = serializers.SerializerMethodField()
    is_deferred = serializers.SerializerMethodField()
    in_sprint_scope = serializers.SerializerMethodField()

    class Meta:
        model = MatchReport
        fields = [
            'report_id',
            'skill_name',
            'skill',
            'category',
            'importance',
            'status',
            'reason',
            'priority',
            'recommended_action',
            'action',
            'task_type',
            'effort_hours_estimate',
            'effort_breakdown',
            'similarity_score',
            'supporting_evidence_ids',
            'supporting_evidence',
            'source_excerpt',
            'is_deferred',
            'in_sprint_scope',
            'created_at'
        ]

    def get_is_deferred(self, obj):
        deferred_skills = set(self.context.get('deferred_skills', []))
        if not deferred_skills:
            return False
        return obj.skill_name in deferred_skills

    def get_in_sprint_scope(self, obj):
        if obj.status == 'Demonstrated':
            return False
        deferred_skills = set(self.context.get('deferred_skills', []))
        return obj.skill_name not in deferred_skills

    def get_effort_breakdown(self, obj):
        if hasattr(obj, 'effort_breakdown') and obj.effort_breakdown:
            return obj.effort_breakdown
        # Fallback dynamic calculation if not already stored
        try:
            from services.matching_engine import SkillMatchingEngine
            if obj.status == "Demonstrated":
                return {
                    "base_hours": 0.0,
                    "complexity_multiplier": 1.0,
                    "category": obj.category,
                    "adjacent_skill_discount": 0.0,
                    "adjacent_skill_name": None,
                    "assessment_scaling_factor": 0.0,
                    "final_hours": 0.0,
                    "explanation": "Demonstrated capability. 0 remediation hours needed."
                }
            mult, cat_label = SkillMatchingEngine.get_skill_complexity(obj.category, obj.skill_name)
            base = 6.0 if obj.status == "Unverified" else (8.0 if obj.status == "Self-reported" else 4.0)
            return {
                "base_hours": base,
                "complexity_multiplier": mult,
                "category": cat_label,
                "adjacent_skill_discount": 0.0,
                "adjacent_skill_name": None,
                "assessment_scaling_factor": 1.0,
                "final_hours": obj.effort_hours_estimate,
                "explanation": f"Base: {base}h ({obj.status}) × {mult} ({cat_label}) = ~{obj.effort_hours_estimate}h"
            }
        except Exception:
            return {}

    def get_supporting_evidence(self, obj):
        if not obj.supporting_evidence_ids:
            return []
        try:
            from apps.profiles.models import SkillEvidence
            records = SkillEvidence.objects.filter(evidence_id__in=obj.supporting_evidence_ids)
            return [
                {
                    "id": rec.evidence_id,
                    "evidence_id": rec.evidence_id,
                    "skill_name": rec.skill_name,
                    "title": rec.title,
                    "reference": rec.reference,
                    "evidence_type": rec.evidence_type,
                    "review_status": rec.review_status,
                    "description": rec.description
                }
                for rec in records
            ]
        except Exception:
            return []
