from django.db import transaction
from django.utils.text import slugify
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from users.permissions import IsBusinessMember, active_business_ids

from .models import Business, Membership


class BusinessSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = [
            "id",
            "owner",
            "name",
            "trading_name",
            "slug",
            "industry_mode",
            "email",
            "phone",
            "website",
            "tax_id",
            "address_line1",
            "address_city",
            "address_postcode",
            "address_country",
            "brand_color",
            "logo_url",
            "role",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "owner", "slug", "created_at", "updated_at", "role"]

    def get_role(self, obj):
        user = self.context["request"].user
        m = Membership.objects.filter(business=obj, user=user).first()
        return m.role if m else None


class MembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_first_name = serializers.CharField(source="user.first_name", read_only=True)
    user_last_name = serializers.CharField(source="user.last_name", read_only=True)

    class Meta:
        model = Membership
        fields = [
            "id",
            "business",
            "user",
            "user_email",
            "user_first_name",
            "user_last_name",
            "role",
            "status",
            "invited_at",
            "joined_at",
        ]
        read_only_fields = ["id", "joined_at"]


class BusinessViewSet(viewsets.ModelViewSet):
    serializer_class = BusinessSerializer
    permission_classes = [permissions.IsAuthenticated, IsBusinessMember]

    def get_queryset(self):
        return Business.objects.filter(
            id__in=active_business_ids(self.request.user)
        ).select_related("owner")

    @transaction.atomic
    def perform_create(self, serializer):
        name = serializer.validated_data["name"]
        slug = slugify(name) or "business"
        base = slug
        n = 0
        while Business.objects.filter(slug=slug).exists():
            n += 1
            slug = f"{base}-{n}"
        biz = serializer.save(owner=self.request.user, slug=slug)
        Membership.objects.get_or_create(
            business=biz,
            user=self.request.user,
            defaults={
                "role": Membership.Role.OWNER,
                "status": Membership.Status.ACTIVE,
            },
        )

    @action(detail=False, methods=["get"])
    def current(self, request):
        biz = self.get_queryset().first()
        if biz is None:
            return Response({"detail": "No business found."}, status=404)
        return Response(self.get_serializer(biz).data)
