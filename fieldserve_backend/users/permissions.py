"""Permission helpers (tenant scoping)."""

from rest_framework.permissions import BasePermission

from businesses.models import Membership


def active_business_ids(user) -> list[int]:
    if not user or not user.is_authenticated:
        return []
    return list(
        Membership.objects.filter(
            user=user, status=Membership.Status.ACTIVE
        ).values_list("business_id", flat=True)
    )


class IsBusinessMember(BasePermission):
    """Allows access only when the target object's `business` is one the
    requesting user has an active Membership in."""

    message = "You are not a member of this business."

    def has_object_permission(self, request, view, obj) -> bool:
        business_id = getattr(obj, "business_id", None) or getattr(obj, "id", None)
        if business_id is None:
            return False
        # For Business itself, obj.id is the business id
        if obj.__class__.__name__ == "Business":
            return obj.id in active_business_ids(request.user)
        return obj.business_id in active_business_ids(request.user)
