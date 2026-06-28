from django.apps import AppConfig


class AnalyticsConfig(AppConfig):
    name = 'analytics'

    def ready(self) -> None:
        # Register signal handlers (Job post_save → rescore the customer).
        from . import signals  # noqa: F401
