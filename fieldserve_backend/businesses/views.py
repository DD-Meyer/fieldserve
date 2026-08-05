from django.db import transaction
from django.utils.text import slugify
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from users.permissions import IsBusinessMember, active_business_ids

from .models import Business, Membership, Service


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


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = [
            "id",
            "business",
            "name",
            "slug",
            "description",
            "duration_minutes",
            "price",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "created_at", "updated_at"]
        extra_kwargs = {"business": {"required": False}}


class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer
    permission_classes = [permissions.IsAuthenticated, IsBusinessMember]
    filterset_fields = ["business", "is_active"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "price", "duration_minutes", "created_at"]

    def get_queryset(self):
        return Service.objects.filter(
            business_id__in=active_business_ids(self.request.user)
        ).select_related("business")

    def _resolve_slug(self, business, name: str, *, exclude_pk: int | None = None) -> str:
        base = slugify(name) or "service"
        slug = base
        n = 0
        qs = Service.objects.filter(business=business)
        if exclude_pk is not None:
            qs = qs.exclude(pk=exclude_pk)
        while qs.filter(slug=slug).exists():
            n += 1
            slug = f"{base}-{n}"
        return slug

    def perform_create(self, serializer):
        biz_ids = active_business_ids(self.request.user)
        biz = serializer.validated_data.get("business")
        if biz is None:
            if not biz_ids:
                raise PermissionDenied("User has no active business.")
            biz = Business.objects.get(pk=biz_ids[0])
        elif biz.id not in biz_ids:
            raise PermissionDenied("Not a member of that business.")
        slug = self._resolve_slug(biz, serializer.validated_data["name"])
        serializer.save(business=biz, slug=slug)

    def perform_update(self, serializer):
        instance = serializer.instance
        new_name = serializer.validated_data.get("name")
        if new_name and new_name != instance.name:
            serializer.save(
                slug=self._resolve_slug(
                    instance.business, new_name, exclude_pk=instance.pk
                )
            )
        else:
            serializer.save()
