from django.shortcuts import render
from django.http import JsonResponse
from .services import get_topology_data 

def index(request):
    # 1. Definisikan Base URL Grafana (biar kalau ganti IP cuma ubah 1 tempat)
    base_url = "http://netdev1.eastasia.cloudapp.azure.com:3000/d-solo/adqkgrv/new-dashboard?orgId=1"
    
    # 2. Daftar Panel Monitoring untuk dikirim ke HTML
    # Tips: id harus unik dan tanpa spasi untuk keperluan HTML ID/Target
    monitoring_panels = [
        {
            'id': 'throughput', 
            'label': 'Throughput', 
            'url': f"{base_url}&panelId=2&refresh=5s"
        },
        {
            'id': 'latency', 
            'label': 'Latency', 
            'url': f"{base_url}&panelId=3&refresh=5s"
        },
        {
            'id': 'cpu', 
            'label': 'CPU Usage', 
            'url': f"{base_url}&panelId=panel-7&refresh=5s"
        },
        {
            'id': 'loss', 
            'label': 'Packet Loss', 
            'url': f"{base_url}&panelId=4&refresh=5s"
        },
        {
            'id': 'memory', 
            'label': 'Memory Usage', 
            'url': f"{base_url}&panelId=8&refresh=5s"
        }
    ]

    context = {
        'monitoring_panels': monitoring_panels
    }
    return render(request, "dashboard/index.html", context)

def topology_api(request):
    data = get_topology_data()
    return JsonResponse(data, safe=False)

def node_control(request, node_id, action):
    # Logika aslinya nanti nembak API Ryu
    print(f"Menerima perintah: {action} untuk {node_id}")
    return JsonResponse({"status": "success", "message": f"{node_id} is now {action}"})

def prometheus_api(request):
    # Pastikan get_prometheus_metrics sudah di-import di atas jika ingin dipakai
    # data = get_prometheus_metrics()
    return JsonResponse({"status": "connected"})