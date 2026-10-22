from django.db import models

class RoadmapTask(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    )
    PRIORITY_CHOICES = (
        ('High', 'High'),
        ('Medium', 'Medium'),
        ('Low', 'Low'),
    )

    task_id = models.CharField(max_length=100, primary_key=True)
    user_id = models.CharField(max_length=100, default="usr_demo_001")
    requirement_id = models.CharField(max_length=100, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    target_skill = models.CharField(max_length=150, default='General')
    task_type = models.CharField(max_length=50, default='assessment')  # assessment | project | study
    priority = models.CharField(max_length=50, choices=PRIORITY_CHOICES, default='High')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='pending')

    # Blueprint 2.0 Section 8 extensions
    action_deliverable = models.TextField(blank=True, help_text="Concrete deliverable, e.g. API tests or schema")
    completion_definition = models.TextField(blank=True, help_text="Specific criteria marking completion")
    effort_hours_estimate = models.FloatField(default=4.0, help_text="Estimated hours needed to finish")
    expected_evidence = models.CharField(max_length=255, blank=True)
    due_date = models.CharField(max_length=100, blank=True)
    milestone = models.CharField(max_length=100, blank=True)
    curated_resources = models.JSONField(default=list, help_text="Official docs and tutorial links")

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.title} [{self.status}]"

class ApplicationChecklist(models.Model):
    item_id = models.CharField(max_length=100, primary_key=True)
    user_id = models.CharField(max_length=100, default="usr_demo_001")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    completed = models.BooleanField(default=False)
    category = models.CharField(max_length=50, default='portfolio')  # cv | portfolio | application

    def __str__(self):
        return f"{self.title} [{'DONE' if self.completed else 'TODO'}]"
