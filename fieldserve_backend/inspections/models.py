from django.conf import settings
from django.db import models


ANGLE_CHOICES = [
    ("front", "Front"),
    ("front_left", "Front left"),
    ("front_right", "Front right"),
    ("left", "Left side"),
    ("right", "Right side"),
    ("rear_left", "Rear left"),
    ("rear_right", "Rear right"),
    ("rear", "Rear"),
    ("roof", "Roof"),
    ("interior_front", "Interior front"),
    ("interior_rear", "Interior rear"),
    ("wheels", "Wheels / tires"),
    ("other", "Other"),
]

REQUIRED_WALKAROUND_ANGLES = (
    "front",
    "front_left",
    "left",
    "rear_left",
    "rear",
    "rear_right",
    "right",
    "front_right",
)


def walkaround_progress(
    job, phase: str = "before"
) -> tuple[list[str], list[str]]:
    cache = getattr(job, "_walkaround_progress_cache", {})
    if phase in cache:
        return cache[phase]
    captured_set = {
        inspection.angle
        for inspection in job.inspections.all()
        if inspection.phase == phase
    }
    captured = [angle for angle in REQUIRED_WALKAROUND_ANGLES if angle in captured_set]
    missing = [angle for angle in REQUIRED_WALKAROUND_ANGLES if angle not in captured_set]
    cache[phase] = (captured, missing)
    job._walkaround_progress_cache = cache
    return captured, missing


class Inspection(models.Model):
    class Phase(models.TextChoices):
        BEFORE = "before", "Before service"
        AFTER = "after", "After service"

    class AnalysisStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        DONE = "done", "Done"
        FAILED = "failed", "Failed"

    job = models.ForeignKey(
        "jobs.Job", on_delete=models.CASCADE, related_name="inspections"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspections",
    )
    phase = models.CharField(
        max_length=10, choices=Phase.choices, default=Phase.BEFORE
    )
    angle = models.CharField(max_length=32, choices=ANGLE_CHOICES)
    photo = models.ImageField(upload_to="inspections/%Y/%m/")
    analysis = models.JSONField(default=dict, blank=True)
    analysis_status = models.CharField(
        max_length=16,
        choices=AnalysisStatus.choices,
        default=AnalysisStatus.PENDING,
    )
    analysis_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["job_id", "phase", "angle", "-created_at"]
        indexes = [
            models.Index(fields=["job", "phase"]),
            models.Index(fields=["analysis_status"]),
        ]

    def __str__(self) -> str:
        return f"Inspection {self.pk} · job {self.job_id} · {self.phase}/{self.angle}"

    @property
    def damage_count(self) -> int:
        try:
            return len(self.analysis.get("damages") or [])
        except (AttributeError, TypeError):
            return 0
