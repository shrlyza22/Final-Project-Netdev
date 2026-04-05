from django.shortcuts import render
from django.http import JsonResponse
import requests  # Jangan lupa import requests

def index(request):
    # 1. Definisikan Base URL Grafana (biar kalau ganti IP cuma ubah 1 tempat)
    base_url = "http://netdev1.eastasia.cloudapp.azure.com:3000/d-solo/adqkgrv/new-dashboard?orgId=1"
    
    # 2. Daftar Panel Monitoring untuk dikirim ke HTML
    monitoring_panels = [
        {'id': 'throughput', 'label': 'Throughput', 'url': f"{base_url}&panelId=2&refresh=5s"},
        {'id': 'latency', 'label': 'Latency', 'url': f"{base_url}&panelId=3&refresh=5s"},
        {'id': 'cpu', 'label': 'CPU Usage', 'url': f"{base_url}&panelId=panel-7&refresh=5s"},
        {'id': 'loss', 'label': 'Packet Loss', 'url': f"{base_url}&panelId=4&refresh=5s"},
        {'id': 'memory', 'label': 'Memory Usage', 'url': f"{base_url}&panelId=8&refresh=5s"}
    ]

    context = {
        'monitoring_panels': monitoring_panels
    }
    return render(request, "dashboard/index.html", context)
