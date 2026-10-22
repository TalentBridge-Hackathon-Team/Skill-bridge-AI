from django.db import models

class JobAnalysis(models.Model):
    MODE_CHOICES = (
        ('job_specific', 'Job-Specific (Deadline-Aware)'),
        ('goal_based', 'Goal-Based (Career/Skill)'),
    )
    STATUS_CHOICES = (
        ('pending', 'Pending Extraction'),
        ('completed', 'Extraction Completed'),
        ('failed', 'Extraction Failed'),
    )

    analysis_id = models.CharField(max_length=100, primary_key=True)
    user_id = models.CharField(max_length=100, default="usr_demo_001")
    mode = models.CharField(max_length=50, choices=MODE_CHOICES, default='job_specific')
    role_title = models.CharField(max_length=255)
    job_text = models.TextField(blank=True)
    job_image = models.FileField(upload_to='job_postings/', null=True, blank=True, help_text="Optional screenshot/image for multimodal extraction")
    days_remaining = models.IntegerField(default=14, help_text="Days remaining before application closing")
    study_hours_per_week = models.FloatField(default=14.0, help_text="Weekly study hours capacity")
    summary = models.TextField(blank=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='completed')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.role_title} ({self.analysis_id})"

class Goal(models.Model):
    GOAL_TYPES = (
        ('job_opportunity', 'Specific Job Opportunity'),
        ('career_role', 'Career Role Goal'),
        ('skill_goal', 'Skill Improvement Goal'),
    )

    goal_id = models.CharField(max_length=100, primary_key=True)
    user_id = models.CharField(max_length=100, default="usr_demo_001")
    goal_type = models.CharField(max_length=50, choices=GOAL_TYPES, default='career_role')
    goal_text = models.CharField(max_length=255)
    target_profile_id = models.CharField(max_length=100, default="prof_junior_backend")
    days_remaining = models.IntegerField(default=30, blank=True, null=True)
    study_hours_per_week = models.FloatField(default=10.0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.goal_text} ({self.goal_type})"

class Requirement(models.Model):
    IMPORTANCE_CHOICES = (
        ('required', 'Required'),
        ('preferred', 'Preferred'),
    )

    requirement_id = models.CharField(max_length=100, primary_key=True)
    analysis = models.ForeignKey(JobAnalysis, related_name='requirements', on_delete=models.CASCADE)
    skill_name = models.CharField(max_length=150)
    category = models.CharField(max_length=100, default='concepts')
    importance = models.CharField(max_length=50, choices=IMPORTANCE_CHOICES, default='required')
    source_excerpt = models.TextField(help_text="Direct excerpt from job text for explainability")
    user_confirmed = models.BooleanField(default=True, help_text="Allows user human review/editing")

    def __str__(self):
        return f"{self.skill_name} [{self.importance}]"
