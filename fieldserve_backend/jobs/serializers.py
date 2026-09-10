from rest_framework import serializers

from inspections.models import walkaround_progress
from businesses.models import Membership
from .indemnity import active_indemnity_for, attach_active_indemnity

from .models import Job
from .scheduling_utils import check_slot


class JobSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(write_only=True, required=False, allow_null=True)
    longitude = serializers.FloatField(write_only=True, required=False, allow_null=True)
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    customer_address = serializers.CharField(source="customer.address", read_only=True)
    assigned_to_first_name = serializers.CharField(
        source="assigned_to.first_name", read_only=True, default=None
    )
    assigned_to_last_name = serializers.CharField(
        source="assigned_to.last_name", read_only=True, default=None
    )
    assigned_to_email = serializers.CharField(
        source="assigned_to.email", read_only=True, default=None
    )
    walkaround_complete = serializers.SerializerMethodField()
    walkaround_captured_angles = serializers.SerializerMethodField()
    walkaround_missing_angles = serializers.SerializerMethodField()
    after_walkaround_complete = serializers.SerializerMethodField()
    after_walkaround_captured_angles = serializers.SerializerMethodField()
    after_walkaround_missing_angles = serializers.SerializerMethodField()
    indemnity_version = serializers.SerializerMethodField()
    indemnity_signed = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = [
            "id",
            "business",
            "customer",
            "customer_name",
            "customer_address",
            "assigned_to",
            "assigned_to_first_name",
            "assigned_to_last_name",
            "assigned_to_email",
            "service_type",
            "notes",
            "address",
            "latitude",
            "longitude",
            "scheduled_at",
            "duration_minutes",
            "price",
            "status",
            "walkaround_complete",
            "walkaround_captured_angles",
            "walkaround_missing_angles",
            "after_walkaround_complete",
            "after_walkaround_captured_angles",
            "after_walkaround_missing_angles",
            "indemnity_version",
            "indemnity_signed",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "completed_at",
            "customer_name",
            "customer_address",
            "assigned_to_first_name",
            "assigned_to_last_name",
            "assigned_to_email",
            "walkaround_complete",
            "walkaround_captured_angles",
            "walkaround_missing_angles",
            "after_walkaround_complete",
            "after_walkaround_captured_angles",
            "after_walkaround_missing_angles",
            "indemnity_version",
            "indemnity_signed",
        ]
        extra_kwargs = {"business": {"required": False}}

    def get_walkaround_complete(self, instance):
        return not walkaround_progress(instance)[1]

    def get_walkaround_captured_angles(self, instance):
        return walkaround_progress(instance)[0]

    def get_walkaround_missing_angles(self, instance):
        return walkaround_progress(instance)[1]

    def get_after_walkaround_complete(self, instance):
        return not walkaround_progress(instance, "after")[1]

    def get_after_walkaround_captured_angles(self, instance):
        return walkaround_progress(instance, "after")[0]

    def get_after_walkaround_missing_angles(self, instance):
        return walkaround_progress(instance, "after")[1]

    def get_indemnity_version(self, instance):
        return getattr(getattr(instance, "indemnity", None), "version", None)

    def get_indemnity_signed(self, instance):
        return bool(getattr(getattr(instance, "indemnity", None), "is_signed", False))

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.location is not None:
            data["latitude"] = instance.location.y
            data["longitude"] = instance.location.x
        return data

    def _apply_latlng(self, validated_data):
        from django.contrib.gis.geos import Point

        lat = validated_data.pop("latitude", None)
        lng = validated_data.pop("longitude", None)
        if lat is not None and lng is not None:
            validated_data["location"] = Point(float(lng), float(lat), srid=4326)
        return validated_data

    def _resolve_business(self, attrs):
        biz = attrs.get("business")
        if biz is None and self.instance is not None:
            biz = self.instance.business
        if biz is None:
            cust = attrs.get("customer")
            if cust is not None:
                biz = cust.business
        return biz

    def validate(self, attrs):
        latitude = attrs.get("latitude")
        longitude = attrs.get("longitude")
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError(
                "Provide both latitude and longitude when selecting an address."
            )
        if latitude is not None and not -90 <= latitude <= 90:
            raise serializers.ValidationError(
                {"latitude": "Latitude must be between -90 and 90."}
            )
        if longitude is not None and not -180 <= longitude <= 180:
            raise serializers.ValidationError(
                {"longitude": "Longitude must be between -180 and 180."}
            )

        scheduled_at = attrs.get("scheduled_at") or (
            self.instance.scheduled_at if self.instance else None
        )
        business = self._resolve_business(attrs)
        if business is None:
            return attrs

        customer = attrs.get("customer") or (
            self.instance.customer if self.instance else None
        )
        effective_address = attrs.get("address")
        if effective_address is None:
            effective_address = (
                self.instance.address if self.instance else getattr(customer, "address", "")
            )
        if latitude is None and longitude is None:
            location = self.instance.location if self.instance else None
            if location is None:
                location = getattr(customer, "location", None)
            if location is not None:
                latitude = location.y
                longitude = location.x

        if business.industry_mode == business.Industry.MOBILE and (
            not str(effective_address or "").strip()
            or latitude is None
            or longitude is None
        ):
            raise serializers.ValidationError(
                {
                    "location": (
                        "Mobile bookings require a customer address and selected map location."
                    )
                }
            )

        if scheduled_at is None:
            return attrs

        assigned_to = attrs.get("assigned_to")
        if assigned_to is not None and not Membership.objects.filter(
            business=business,
            user=assigned_to,
            status=Membership.Status.ACTIVE,
        ).exists():
            raise serializers.ValidationError(
                {"assigned_to": "Assigned user must be an active member of this business."}
            )

        duration = attrs.get("duration_minutes") or (
            self.instance.duration_minutes if self.instance else None
        ) or 30

        result = check_slot(
            business=business,
            scheduled_at=scheduled_at,
            duration_minutes=int(duration),
            lat=float(latitude) if latitude is not None else None,
            lng=float(longitude) if longitude is not None else None,
            exclude_job_id=self.instance.pk if self.instance else None,
        )
        if not result.ok:
            raise serializers.ValidationError(result.as_error())
        return attrs

    def create(self, validated_data):
        validated_data = self._apply_latlng(validated_data)
        cust = validated_data.get("customer")
        if cust and not validated_data.get("address"):
            validated_data["address"] = cust.address
        if cust and "location" not in validated_data and cust.location is not None:
            validated_data["location"] = cust.location.clone()
        if cust and "business" not in validated_data:
            validated_data["business"] = cust.business
        active_indemnity_for(validated_data["business"])
        job = super().create(validated_data)
        attach_active_indemnity(job)
        return job

    def update(self, instance, validated_data):
        validated_data = self._apply_latlng(validated_data)
        return super().update(instance, validated_data)
