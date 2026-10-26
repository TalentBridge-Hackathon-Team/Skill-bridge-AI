from django.contrib import admin
from .models import RoadmapTask, ApplicationChecklist

@admin.register(RoadmapTask)
class RoadmapTaskAdmin(admin.ModelAdmin):
    list_display = ('task_id', 'user_id', 'title', 'target_skill', 'priority', 'status', 'effort_hours_estimate', 'due_date')
    list_filter = ('status', 'priority', 'task_type', 'user_id')
    search_fields = ('title', 'target_skill', 'user_id', 'task_id', 'action_deliverable')
    ordering = ('due_date', 'task_id')

@admin.register(ApplicationChecklist)
class ApplicationChecklistAdmin(admin.ModelAdmin):
    list_display = ('item_id', 'user_id', 'title', 'category', 'completed')
    list_filter = ('completed', 'category', 'user_id')
    search_fields = ('title', 'description', 'user_id', 'item_id')
