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


# def topology_api(request):
#     """
#     Fungsi ini menggantikan peran services.py. 
#     Dipanggil HANYA SEKALI oleh index.html saat pertama kali load.
#     """
#     IP_RYU = "netdev1.eastasia.cloudapp.azure.com"
#     PORT = "8080"

#     try:
#         sw_req = requests.get(f'http://{IP_RYU}:{PORT}/v1.0/topology/switches', timeout=3)
#         ln_req = requests.get(f'http://{IP_RYU}:{PORT}/v1.0/topology/links', timeout=3)

#         if sw_req.status_code == 200:
#             switches = sw_req.json()
#             links_raw = ln_req.json() if ln_req.status_code == 200 else []

#             nodes = [{"id": f"s{int(s['dpid'], 16)}", "type": "switch"} for s in switches]
#             links = [{"source": f"s{int(l['src']['dpid'], 16)}", "target": f"s{int(l['dst']['dpid'], 16)}"} for l in links_raw]

#             if nodes:
#                 return JsonResponse({"nodes": nodes, "links": links}, safe=False)
#             else:
#                 print("⚠️ API Ryu merespons, tapi data switch masih kosong.")
                
#     except Exception as e:
#         print(f"❌ ERROR KONEKSI KE AZURE (Initial Load): {e}")

#     # Jika error / data kosong, kembalikan array kosong agar frontend memunculkan Notifikasi Error Merah
#     return JsonResponse({"nodes": [], "links": []}, safe=False)


# def node_control(request, node_id, action):
#     # Logika aslinya nanti nembak API Ryu
#     print(f"Menerima perintah: {action} untuk {node_id}")
#     return JsonResponse({"status": "success", "message": f"{node_id} is now {action}"})


# def prometheus_api(request):
#     # Menggantikan fungsi get_prometheus_metrics() yang sebelumnya nganggur di services.py
#     return JsonResponse({"status": "connected"})