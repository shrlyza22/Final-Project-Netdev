from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # URL ini yang akan dipanggil di JavaScript (topology.js)
    re_path(r'ws/topology/$', consumers.TopologyConsumer.as_asgi()),
]