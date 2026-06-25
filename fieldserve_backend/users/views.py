from rest_framework import generics, permissions, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from businesses.models import Membership

from .models import Customer
from .permissions import IsBusinessMember, active_business_ids
from .serializers import CustomerSerializer, UserSerializer


class MeView(generics.RetrieveUpdateAPIView):
    """GET /api/auth/me/ returns the current user + memberships."""

    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        user = self.get_object()
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
