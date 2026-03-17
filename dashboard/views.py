from django.shortcuts import render

# Create your views here.
from django.http import JsonResponse
from .services import get_topology_data


def index(request):
    return render(request, "dashboard/index.html")


def topology_api(request):
    data = get_topology_data()
    return JsonResponse(data)

def node_control(request, node_id, action):
    # Logika aslinya nanti nembak API Ryu buat hapus flow atau matiin port
    print(f"Menerima perintah: {action} untuk {node_id}")
    return JsonResponse({"status": "success", "message": f"{node_id} is now {action}"})

def prometheus_api(request):
    data = get_prometheus_metrics()
    return JsonResponse(data)
