from rest_framework import serializers

from .models import Customer, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "avatar_url",
            "clerk_user_id",
        ]
        read_only_fields = ["id", "username", "clerk_user_id"]


class CustomerSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(write_only=True, required=False, allow_null=True)
    longitude = serializers.FloatField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Customer
        fields = [
            "id",
            "business",
            "full_name",
            "email",
            "phone",
            "address",
            "notes",
            "latitude",
            "longitude",
            "last_seen_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"business": {"required": False}}

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

    def validate_location_for_business(self, attrs, business):
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

        address = attrs.get("address")
        if address is None and self.instance is not None:
            address = self.instance.address
        location = self.instance.location if self.instance is not None else None
        has_location = latitude is not None and longitude is not None or location is not None
        if business.industry_mode == business.Industry.MOBILE and (
            not str(address or "").strip() or not has_location
        ):
            raise serializers.ValidationError(
                {
                    "location": (
                        "Mobile customers require an address and selected map location."
                    )
                }
            )
        return attrs

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        if business is not None:
            self.validate_location_for_business(attrs, business)
        else:
            latitude = attrs.get("latitude")
            longitude = attrs.get("longitude")
            if (latitude is None) != (longitude is None):
                raise serializers.ValidationError(
                    "Provide both latitude and longitude when selecting an address."
                )
        return attrs

    def create(self, validated_data):
        validated_data = self._apply_latlng(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._apply_latlng(validated_data)
        customer = super().update(instance, validated_data)
        if customer.location is not None:
            from jobs.models import Job

            Job.objects.filter(
                customer=customer,
                location__isnull=True,
                status__in=[
                    Job.Status.PENDING,
                    Job.Status.SCHEDULED,
                    Job.Status.IN_PROGRESS,
                ],
            ).update(address=customer.address, location=customer.location)
        return customer
