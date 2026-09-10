import uuid

from django.db import transaction
from django.utils.text import slugify
from rest_framework import generics, permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from businesses.clerk import ClerkAPIError, get_organization
from businesses.models import Business, Membership

from .models import Customer
from .permissions import IsBusinessMember, active_business_ids
from .serializers import CustomerSerializer, UserSerializer


class MeView(generics.RetrieveUpdateAPIView):
    """GET /api/auth/me/ returns the current user + memberships."""

    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    @transaction.atomic
    def _sync_active_clerk_organization(self, request) -> None:
        claims = request.auth if isinstance(request.auth, dict) else {}
        organization_claim = claims.get("o") or {}
        organization_id = organization_claim.get("id")
        if not organization_id:
            return

        try:
            organization = get_organization(organization_id)
        except ClerkAPIError:
            return

        role = (
            Membership.Role.ADMIN
            if organization_claim.get("role") in {"admin", "org:admin"}
            else Membership.Role.STAFF
        )
        business = Business.objects.filter(clerk_organization_id=organization_id).first()
        if business is None:
            if organization.get("created_by") != request.user.clerk_user_id:
                return
            name = str(organization.get("name") or "FieldServe business").strip()
            base_slug = slugify(name) or "business"
            business = Business.objects.create(
                owner=request.user,
                name=name,
                slug=f"{base_slug}-{uuid.uuid4().hex[:6]}",
                clerk_organization_id=organization_id,
            )

        membership, _ = Membership.objects.get_or_create(
            business=business,
            user=request.user,
            defaults={"role": role, "status": Membership.Status.ACTIVE},
        )
        if membership.role != role or membership.status != Membership.Status.ACTIVE:
            membership.role = role
            membership.status = Membership.Status.ACTIVE
            membership.save(update_fields=["role", "status"])

    def retrieve(self, request, *args, **kwargs):
        user = self.get_object()
        self._sync_active_clerk_organization(request)
        data = UserSerializer(user).data
        memberships = (
            Membership.objects.filter(user=user)
            .select_related("business")
            .order_by("business_id")
        )
        data["memberships"] = [
            {
                "id": m.id,
                "business_id": m.business_id,
                "business_name": m.business.name,
                "business_slug": m.business.slug,
                "industry_mode": m.business.industry_mode,
                "role": m.role,
                "status": m.status,
            }
            for m in memberships
        ]
        return Response(data)


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated, IsBusinessMember]
    search_fields = ["full_name", "email", "phone", "address"]
    ordering_fields = ["full_name", "created_at", "last_seen_at"]
    filterset_fields = ["business"]

    def get_queryset(self):
        return (
            Customer.objects.select_related("business")
            .filter(business_id__in=active_business_ids(self.request.user))
        )

    def perform_create(self, serializer):
        biz_ids = active_business_ids(self.request.user)
        requested = serializer.validated_data.get("business")
        if requested is None:
            if not biz_ids:
                raise PermissionDenied("User has no active business.")
            serializer.save(business_id=biz_ids[0])
        else:
            if requested.id not in biz_ids:
                raise PermissionDenied("Not a member of that business.")
            serializer.save()


class OnboardUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        company_name = str(request.data.get("company_name") or "").strip()
        organization_id = str(request.data.get("organization_id") or "").strip()
        industry_mode = request.data.get("industry_mode", "fixed")

        if not company_name:
            return Response(
                {"detail": "Company name is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not organization_id:
            return Response(
                {"detail": "Clerk organization ID is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if industry_mode not in (Business.Industry.FIXED, Business.Industry.MOBILE):
            return Response(
                {"detail": "Industry mode must be fixed or mobile."},
                status=status.HTTP_400_BAD_REQUEST
            )

        existing = Business.objects.filter(
            clerk_organization_id=organization_id
        ).first()
        if existing is not None:
            if not Membership.objects.filter(
                user=request.user,
                business=existing,
                status=Membership.Status.ACTIVE,
            ).exists():
                return Response(
                    {"detail": "This Clerk organization belongs to another account."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return Response(
                {"message": "Business already connected", "slug": existing.slug},
                status=status.HTTP_200_OK,
            )

        base_slug = slugify(company_name) or "business"
        unique_slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

        business = Business.objects.create(
            name=company_name,
            slug=unique_slug,
            industry_mode=industry_mode,
            owner=request.user,
            clerk_organization_id=organization_id,
        )

        Membership.objects.get_or_create(
            user=request.user,
            business=business,
            defaults={
                "role": Membership.Role.ADMIN,
                "status": Membership.Status.ACTIVE,
            },
        )

        return Response(
            {"message": "Business created successfully", "slug": unique_slug},
            status=status.HTTP_201_CREATED
        )