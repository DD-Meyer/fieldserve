from rest_framework import serializers

from .models import Job


class JobSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(write_only=True, required=False, allow_null=True)
    longitude = serializers.FloatField(write_only=True, required=False, allow_null=True)
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    customer_address = serializers.CharField(source="customer.address", read_only=True)

    class Meta:
        model = Job
        fields = [
            "id",
            "business",
            "customer",
            "customer_name",
            "customer_address",
            "assigned_to",
            "service_type",
            "notes",
            "address",
            "latitude",
            "longitude",
            "scheduled_at",
            "duration_minutes",
            "price",
            "status",
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
        ]
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

    def create(self, validated_data):
        validated_data = self._apply_latlng(validated_data)
        cust = validated_data.get("customer")
        if cust and not validated_data.get("address"):
            validated_data["address"] = cust.address
        if cust and "business" not in validated_data:
            validated_data["business"] = cust.business
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._apply_latlng(validated_data)
        return super().update(instance, validated_data)
