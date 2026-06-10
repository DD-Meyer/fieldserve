from rest_framework import serializers, viewsets

from .models import Business


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = ["id", "owner", "name", "slug", "created_at"]
        read_only_fields = ["id", "owner", "created_at"]


class BusinessViewSet(viewsets.ModelViewSet):
    queryset = Business.objects.select_related("owner").all()
    serializer_class = BusinessSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
