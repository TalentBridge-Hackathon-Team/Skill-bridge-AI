from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0003_skillevidence_embedding'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='professional_background',
            field=models.TextField(
                blank=True,
                help_text='Summary of work history and professional context'
            ),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='project_descriptions',
            field=models.JSONField(
                default=list,
                help_text='List of {title, description, link, skills_demonstrated[]}'
            ),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='target_date',
            field=models.DateField(
                blank=True,
                null=True,
                help_text='Target date for achieving the goal/role'
            ),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='study_capacity_hours_per_week',
            field=models.PositiveSmallIntegerField(
                default=10,
                help_text='Self-reported weekly study hours'
            ),
        ),
    ]
