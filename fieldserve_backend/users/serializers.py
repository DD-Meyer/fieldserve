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

    def create(self, validated_data):
        validated_data = self._apply_latlng(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._apply_latlng(validated_data)
        return super().update(instance, validated_data)
