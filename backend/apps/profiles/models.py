from django.db import models
from pgvector.django import VectorField

class UserProfile(models.Model):
    user_id = models.CharField(max_length=100, primary_key=True)
    name = models.CharField(max_length=200, default="")
    target_role = models.CharField(max_length=200, default="", blank=True)
    education = models.CharField(max_length=255, blank=True)
    experience_level = models.CharField(max_length=100, default="Entry Level")
    skills = models.JSONField(default=list)  # list of skill names
    professional_background = models.TextField(blank=True, help_text="Summary of work history and professional context")
    project_descriptions = models.JSONField(default=list, help_text="List of {title, description, link, skills_demonstrated[]}")
    # Goal context parameters
    target_date = models.DateField(null=True, blank=True, help_text="Target date for achieving the goal/role")
    study_capacity_hours_per_week = models.PositiveSmallIntegerField(default=10, help_text="Self-reported weekly study hours")
    resume_file = models.FileField(upload_to='resumes/', null=True, blank=True)
    resume_parsed_text = models.TextField(blank=True, help_text="Parsed CV text for RAG/embedding extraction")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.user_id})"

class SkillEvidence(models.Model):
    EVIDENCE_TYPES = (
        ('project', 'Project Repository / Code'),
        ('self_reported', 'Self Reported Claim'),
        ('assessment', 'Verified Assessment'),
    )
    REVIEW_STATUSES = (
        ('verified', 'Verified'),
        ('unverified', 'Unverified'),
        ('needs_improvement', 'Needs Improvement'),
    )

    evidence_id = models.CharField(max_length=100, primary_key=True)
    profile = models.ForeignKey(UserProfile, related_name='evidence_records', on_delete=models.CASCADE)
    skill_name = models.CharField(max_length=150)
    evidence_type = models.CharField(max_length=50, choices=EVIDENCE_TYPES, default='project')
    title = models.CharField(max_length=255)
    reference = models.URLField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    review_status = models.CharField(max_length=50, choices=REVIEW_STATUSES, default='verified')
    embedding = VectorField(dimensions=2048, null=True, blank=True, help_text="OpenRouter 2048-dim vector embedding")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.skill_name} - {self.title} ({self.review_status})"
