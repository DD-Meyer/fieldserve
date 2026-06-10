from rest_framework import generics, permissions, viewsets

from .models import Customer, User
from .serializers import CustomerSerializer, RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.select_related("business").all()
    serializer_class = CustomerSerializer
