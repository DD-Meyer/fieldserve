import hashlib

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from users.permissions import IsBusinessMember, active_business_ids, default_business_for, is_active_admin

from .clerk import (
    ClerkAPIError,
    create_organization_invitation,
    delete_organization_membership,
    revoke_organization_invitation,
    update_organization_membership,
)
from .models import Business, IndemnityDocument, Membership, Service


class BusinessSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    depot_latitude = serializers.FloatField(write_only=True, required=False, allow_null=True)
    depot_longitude = serializers.FloatField(write_only=True, required=False, allow_null=True)

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
            "working_hours_start",
            "working_hours_end",
            "default_travel_buffer_minutes",
            "depot_latitude",
            "depot_longitude",
            "role",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "owner", "slug", "created_at", "updated_at", "role"]

    def get_role(self, obj):
        user = self.context["request"].user
        m = Membership.objects.filter(business=obj, user=user).first()
        return m.role if m else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.depot_location is not None:
            data["depot_latitude"] = instance.depot_location.y
            data["depot_longitude"] = instance.depot_location.x
        else:
            data["depot_latitude"] = None
            data["depot_longitude"] = None
        return data

    def _apply_depot(self, validated_data):
        from django.contrib.gis.geos import Point

        lat = validated_data.pop("depot_latitude", None)
        lng = validated_data.pop("depot_longitude", None)
        if lat is not None and lng is not None:
            validated_data["depot_location"] = Point(float(lng), float(lat), srid=4326)
        return validated_data

    def create(self, validated_data):
        return super().create(self._apply_depot(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._apply_depot(validated_data))


class MembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True, allow_null=True)
    user_first_name = serializers.CharField(source="user.first_name", read_only=True, allow_null=True)
    user_last_name = serializers.CharField(source="user.last_name", read_only=True, allow_null=True)
    services = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = Membership
        fields = [
            "id",
            "business",
            "user",
            "user_email",
            "user_first_name",
            "user_last_name",
            "invited_email",
            "role",
            "status",
            "invited_at",
            "joined_at",
            "services",
            "buffer_minutes",
        ]
        read_only_fields = ["id", "business", "user", "invited_email", "status", "invited_at", "joined_at"]


class MembershipUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Membership
        fields = ["role", "services", "buffer_minutes"]
        extra_kwargs = {
            "role": {"required": False},
            "services": {"required": False},
            "buffer_minutes": {"required": False},
        }

    def validate_role(self, value):
        if value not in Membership.Role.values:
            raise serializers.ValidationError("Use either admin or staff.")
        return value

    def validate_services(self, value):
        business_id = self.instance.business_id if self.instance else None
        for service in value:
            if business_id is not None and service.business_id != business_id:
                raise serializers.ValidationError("Service does not belong to this business.")
        return value


class IndemnityDocumentSerializer(serializers.ModelSerializer):
    document_url = serializers.SerializerMethodField()

    class Meta:
        model = IndemnityDocument
        fields = [
            "id", "business", "version", "source", "text", "document", "document_url",
            "checksum", "status", "published_at", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "business", "version", "checksum", "status", "published_at",
            "created_at", "updated_at", "document_url",
        ]

    def get_document_url(self, obj):
        if not obj.document:
            return None
        request = self.context.get("request")
        url = obj.document.url
        return request.build_absolute_uri(url) if request else url

    def validate(self, attrs):
        source = attrs.get("source", getattr(self.instance, "source", None))
        text = attrs.get("text", getattr(self.instance, "text", ""))
        document = attrs.get("document", getattr(self.instance, "document", None))
        if source == IndemnityDocument.Source.TEXT and not text.strip():
            raise serializers.ValidationError({"text": "Text indemnities cannot be empty."})
        if source == IndemnityDocument.Source.PDF:
            if not document:
                raise serializers.ValidationError({"document": "A PDF is required."})
            if document.content_type != "application/pdf" or document.size > 10 * 1024 * 1024:
                raise serializers.ValidationError({"document": "Upload a PDF no larger than 10 MB."})
        return attrs


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
                "role": Membership.Role.ADMIN,
                "status": Membership.Status.ACTIVE,
            },
        )

    def _require_admin(self, business):
        if not is_active_admin(self.request.user, business.id):
            raise PermissionDenied("Only Admins can manage the team.")

    def _protect_final_admin(self, business, membership):
        active_admins = business.memberships.filter(
            role=Membership.Role.ADMIN,
            status=Membership.Status.ACTIVE,
        ).count()
        if membership.role == Membership.Role.ADMIN and membership.status == Membership.Status.ACTIVE and active_admins <= 1:
            raise serializers.ValidationError("A business must retain at least one active Admin.")

    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, pk=None):
        business = self.get_object()
        self._require_admin(business)
        queryset = business.memberships.select_related("user").all()
        return Response(MembershipSerializer(queryset, many=True).data)

    @action(detail=True, methods=["post"], url_path="members/invite")
    def invite_member(self, request, pk=None):
        business = self.get_object()
        self._require_admin(business)
        email = str(request.data.get("email", "")).strip().lower()
        role = request.data.get("role", Membership.Role.STAFF)
        if not email:
            raise serializers.ValidationError({"email": "Email is required."})
        if role not in Membership.Role.values:
            raise serializers.ValidationError({"role": "Use either admin or staff."})
        if not business.clerk_organization_id:
            raise serializers.ValidationError("This business is not connected to a Clerk organisation.")
        if business.memberships.filter(invited_email__iexact=email, status=Membership.Status.INVITED).exists():
            raise serializers.ValidationError({"email": "This email already has a pending invitation."})
        try:
            invitation = create_organization_invitation(
                business.clerk_organization_id,
                request.user.clerk_user_id,
                email,
                role,
            )
        except ClerkAPIError as exc:
            raise serializers.ValidationError({"detail": str(exc)}) from exc
        membership = Membership.objects.create(
            business=business,
            invited_email=email,
            clerk_invitation_id=invitation.get("id", ""),
            role=role,
            status=Membership.Status.INVITED,
            invited_at=timezone.now(),
        )
        return Response(MembershipSerializer(membership).data, status=201)

    @action(detail=True, methods=["patch", "delete"], url_path=r"members/(?P<membership_id>[^/.]+)")
    def member_detail(self, request, pk=None, membership_id=None):
        business = self.get_object()
        self._require_admin(business)
        membership = business.memberships.filter(pk=membership_id).first()
        if membership is None:
            return Response({"detail": "Member not found."}, status=404)
        if membership.user_id == business.owner_id:
            raise PermissionDenied("The original account cannot be changed or removed.")
        if request.method == "DELETE":
            self._protect_final_admin(business, membership)
            try:
                if membership.status == Membership.Status.INVITED and membership.clerk_invitation_id:
                    revoke_organization_invitation(
                        business.clerk_organization_id,
                        membership.clerk_invitation_id,
                        request.user.clerk_user_id,
                    )
                elif membership.user and membership.user.clerk_user_id:
                    delete_organization_membership(
                        business.clerk_organization_id,
                        membership.user.clerk_user_id,
                    )
            except ClerkAPIError as exc:
                if (
                    membership.status == Membership.Status.INVITED
                    and exc.code == "organization_invitation_not_pending"
                ):
                    membership.status = Membership.Status.INACTIVE
                    membership.save(update_fields=["status"])
                    return Response(status=204)
                raise serializers.ValidationError({"detail": str(exc)}) from exc
            membership.status = Membership.Status.INACTIVE
            membership.save(update_fields=["status"])
            return Response(status=204)
        if membership.status != Membership.Status.ACTIVE or not membership.user_id:
            raise serializers.ValidationError("Only active members can be edited.")
        serializer = MembershipUpdateSerializer(membership, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "role" in serializer.validated_data and serializer.validated_data["role"] != membership.role:
            if serializer.validated_data["role"] != Membership.Role.ADMIN:
                self._protect_final_admin(business, membership)
            try:
                update_organization_membership(
                    business.clerk_organization_id,
                    membership.user.clerk_user_id,
                    serializer.validated_data["role"],
                )
            except ClerkAPIError as exc:
                raise serializers.ValidationError({"detail": str(exc)}) from exc
        serializer.save()
        return Response(MembershipSerializer(membership).data)

    @action(detail=False, methods=["get"])
    def current(self, request):
        biz = default_business_for(request.user)
        if biz is None:
            return Response({"detail": "No business found."}, status=404)
        return Response(self.get_serializer(biz).data)


class IndemnityDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = IndemnityDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return IndemnityDocument.objects.filter(
            business_id__in=[
                business_id for business_id in active_business_ids(self.request.user)
                if is_active_admin(self.request.user, business_id)
            ]
        ).select_related("business", "created_by")

    def perform_create(self, serializer):
        business_id = self.request.data.get("business")
        if not business_id or not is_active_admin(self.request.user, int(business_id)):
            raise PermissionDenied("Only Admins can manage indemnities.")
        business = Business.objects.get(pk=business_id)
        version = (business.indemnities.aggregate(max_version=Max("version"))["max_version"] or 0) + 1
        document = serializer.validated_data.get("document")
        checksum = ""
        if document:
            checksum = hashlib.sha256(document.read()).hexdigest()
            document.seek(0)
        serializer.save(
            business=business,
            created_by=self.request.user,
            version=version,
            checksum=checksum,
        )

    def perform_update(self, serializer):
        if serializer.instance.status != IndemnityDocument.Status.DRAFT:
            raise PermissionDenied("Published and archived indemnities are immutable.")
        serializer.save()

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        document = self.get_object()
        if document.status != IndemnityDocument.Status.DRAFT:
            raise serializers.ValidationError("Only drafts can be published.")
        document.business.indemnities.filter(
            status=IndemnityDocument.Status.PUBLISHED
        ).update(status=IndemnityDocument.Status.ARCHIVED)
        document.status = IndemnityDocument.Status.PUBLISHED
        document.published_at = timezone.now()
        document.save(update_fields=["status", "published_at", "updated_at"])
        return Response(self.get_serializer(document).data)

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        document = self.get_object()
        if document.status == IndemnityDocument.Status.ARCHIVED:
            return Response(self.get_serializer(document).data)
        document.status = IndemnityDocument.Status.ARCHIVED
        document.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(document).data)


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
            biz = default_business_for(self.request.user)
            if biz is None:
                raise PermissionDenied("User has no active business.")
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
