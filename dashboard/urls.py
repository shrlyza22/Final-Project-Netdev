from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='dashboard'),
    # path('api/topology/', views.topology_api, name='topology_api'),
    # path('api/node-control/<str:node_id>/<str:action>/', views.node_control, name='node_control'),
    # path('api/metrics/', views.prometheus_api),
]