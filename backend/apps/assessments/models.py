from django.db import models

class AssessmentTask(models.Model):
    TASK_TYPES = (
        ('api_testing', 'API Testing & Verification'),
        ('sql_queries', 'SQL & Database Queries'),
    )

    task_id = models.CharField(max_length=100, primary_key=True)
    title = models.CharField(max_length=255)
    task_type = models.CharField(max_length=50, choices=TASK_TYPES, default='api_testing')
    target_skill = models.CharField(max_length=150, default='API Testing')
    total_points = models.IntegerField(default=10)
    instructions = models.TextField()
    rubric = models.JSONField(default=list)  # list of criteria with point values and descriptions

    def __str__(self):
        return f"{self.title} ({self.total_points} pts)"

class AssessmentSubmission(models.Model):
    STATUS_CHOICES = (
        ('passed', 'Passed'),
        ('failed', 'Needs Improvement'),
    )

    submission_id = models.CharField(max_length=100, primary_key=True)
    task = models.ForeignKey(AssessmentTask, related_name='submissions', on_delete=models.CASCADE)
    user_id = models.CharField(max_length=100, default="usr_demo_001")
    task_type = models.CharField(max_length=50, default='api_testing')
    submission_data = models.JSONField(default=dict)
    score = models.IntegerField(default=0)
    max_score = models.IntegerField(default=10)
    feedback = models.JSONField(default=dict)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='failed')
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Submission {self.submission_id} - Score: {self.score}/{self.max_score} ({self.status})"
