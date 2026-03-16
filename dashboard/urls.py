from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='dashboard'),
    path('api/topology/', views.topology_api, name='topology_api'),
]