"""
ASGI config for utama project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""
import os
from django.core.asgi import get_asgi_application

# 1. SET ENVIRONMENT VARIABLE DULU
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'utama.settings')

# 2. INISIALISASI HTTP APPLICATION DULU (WAJIB SEBELUM IMPORT ROUTING)
django_asgi_app = get_asgi_application()

# 3. BARU IMPORT CHANNELS DAN ROUTING KAMU
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import dashboard.routing 

# 4. DEFINISIKAN PROTOCOL ROUTER
application = ProtocolTypeRouter({
    "http": django_asgi_app, # Gunakan variabel yang sudah diinisialisasi tadi
    "websocket": AuthMiddlewareStack(
        URLRouter(
            dashboard.routing.websocket_urlpatterns
        )
    ),
})