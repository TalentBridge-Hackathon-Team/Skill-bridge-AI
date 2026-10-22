from django.db import models
from apps.job_analysis.models import JobAnalysis, Requirement

class MatchReport(models.Model):
    STATUS_CHOICES = (
        ('Demonstrated', 'Demonstrated'),
        ('Self-reported', 'Self-reported'),
        ('Unverified', 'Unverified'),
        ('Needs improvement', 'Needs improvement'),
    )
    PRIORITY_CHOICES = (
        ('High', 'High'),
        ('Medium', 'Medium'),
        ('Low', 'Low'),
    )

    report_id = models.CharField(max_length=100, primary_key=True)
    analysis = models.ForeignKey(JobAnalysis, related_name='match_reports', on_delete=models.CASCADE)
    requirement = models.ForeignKey(Requirement, related_name='matched_results', on_delete=models.CASCADE, null=True, blank=True)
    skill_name = models.CharField(max_length=150)
    category = models.CharField(max_length=100, default='concepts')
    importance = models.CharField(max_length=50, default='required')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Unverified')
    reason = models.TextField()
    priority = models.CharField(max_length=50, choices=PRIORITY_CHOICES, default='Medium')
    recommended_action = models.CharField(max_length=255, blank=True)
    task_type = models.CharField(max_length=50, default='assessment')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.skill_name} -> {self.status} [{self.priority}]"
