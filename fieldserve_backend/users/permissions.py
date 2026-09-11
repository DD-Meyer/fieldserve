"""Permission helpers (tenant scoping)."""

from rest_framework.permissions import BasePermission

from businesses.models import Business, Membership


def active_membership(user, business_id: int) -> Membership | None:
    if not user or not user.is_authenticated:
        return None
    return Membership.objects.filter(
        user=user,
        business_id=business_id,
        status=Membership.Status.ACTIVE,
    ).first()


def is_active_admin(user, business_id: int) -> bool:
    membership = active_membership(user, business_id)
    return membership is not None and membership.role == Membership.Role.ADMIN


def active_admin_business_ids(user) -> list[int]:
    if not user or not user.is_authenticated:
        return []
    return list(
        Membership.objects.filter(
            user=user,
            status=Membership.Status.ACTIVE,
            role=Membership.Role.ADMIN,
        ).values_list("business_id", flat=True)
    )


def active_staff_business_ids(user) -> list[int]:
    if not user or not user.is_authenticated:
        return []
    return list(
        Membership.objects.filter(
            user=user,
            status=Membership.Status.ACTIVE,
            role=Membership.Role.STAFF,
        ).values_list("business_id", flat=True)
    )


def active_business_ids(user) -> list[int]:
    if not user or not user.is_authenticated:
        return []
    return list(
        Membership.objects.filter(
            user=user, status=Membership.Status.ACTIVE
        ).values_list("business_id", flat=True)
    )


def default_business_for(user) -> Business | None:
    """The business the rest of the app treats as "current" for this user.

    Mirrors `BusinessViewSet.current()`: the oldest business they own, else
    the most recently joined business they're an active member of. Used
    anywhere a create endpoint needs to pick a business when none is given
    explicitly, so new records land on the same business the UI is showing.
    """
    biz_ids = active_business_ids(user)
    if not biz_ids:
        return None
    qs = Business.objects.filter(id__in=biz_ids)
    biz = qs.filter(owner=user).order_by("created_at", "id").first()
    if biz is None:
        biz = qs.order_by("-created_at", "-id").first()
    return biz


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
