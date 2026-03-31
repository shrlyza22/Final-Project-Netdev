# import requests

# def get_topology_data():
#     # Pastikan ini IP Public Azure VM1 lu
#     IP_RYU = "netdev1.eastasia.cloudapp.azure.com" 
#     PORT = "8080"
    
#     try:
#         # Tambahin ryu.app.rest_topology di running docker lu biar endpoint ini ada
#         sw_req = requests.get(f'http://{IP_RYU}:{PORT}/v1.0/topology/switches', timeout=3)
#         ln_req = requests.get(f'http://{IP_RYU}:{PORT}/v1.0/topology/links', timeout=3)
        
#         if sw_req.status_code == 200:
#             switches = sw_req.json()
#             links_raw = ln_req.json()
            
#             nodes = [{"id": f"s{int(s['dpid'], 16)}", "type": "switch"} for s in switches]
#             links = [{"source": f"s{int(l['src']['dpid'], 16)}", "target": f"s{int(l['dst']['dpid'], 16)}"} for l in links_raw]
            
#             # Kalau dapet data kosong dari Ryu (Ryu nyala tapi Mininet mati)
#             if not nodes:
#                 print("DEBUG: Ryu nyala tapi data switch kosong (Cek Mininet VM2)")
                
#             return {"nodes": nodes, "links": links}
            
#     except Exception as e:
#         print(f"DEBUG ERROR KONEKSI AZURE: {e}")
#         # Kembalikan data Diamond asli lu sebagai cadangan kalau Azure gagal
#         return {
#             "nodes": [
#                 {"id": "s1", "type": "switch"}, {"id": "s2", "type": "switch"},
#                 {"id": "s3", "type": "switch"}, {"id": "s4", "type": "switch"},
#                 {"id": "h1", "type": "host"}, {"id": "h2", "type": "host"},
#                 {"id": "h3", "type": "host"}, {"id": "h4", "type": "host"}
#             ],
#             "links": [
#                 {"source": "s1", "target": "s2"}, {"source": "s1", "target": "s3"},
#                 {"source": "s4", "target": "s2"}, {"source": "s4", "target": "s3"},
#                 {"source": "s1", "target": "h1"}, {"source": "s4", "target": "h2"},
#                 {"source": "s3", "target": "h3"}, {"source": "s2", "target": "h4"}
#             ]
#         }
    
import requests

def get_topology_data():
    IP_RYU = "127.0.0.1"
    PORT = "8080"

    try:
        sw_req = requests.get(f'http://{IP_RYU}:{PORT}/v1.0/topology/switches', timeout=3)
        ln_req = requests.get(f'http://{IP_RYU}:{PORT}/v1.0/topology/links', timeout=3)

        if sw_req.status_code == 200:
            switches = sw_req.json()
            links_raw = ln_req.json()

            nodes = [
                {"id": f"s{int(s['dpid'], 16)}", "type": "switch"}
                for s in switches
            ]

            links = [
                {"source": f"s{int(l['src']['dpid'], 16)}",
                "target": f"s{int(l['dst']['dpid'], 16)}"}
                for l in links_raw
            ]

            # 🔥 FIX DI SINI
            if nodes:
                return {"nodes": nodes, "links": links}
            else:
                print("⚠️ Ryu hidup tapi data kosong → pakai dummy")

    except Exception as e:
        print(f"❌ ERROR AZURE: {e}")

    # 🔥 FALLBACK DUMMY (SEKARANG PASTI KEPAKAI)
    return {
        "nodes": [
            {"id": "s1", "type": "switch"},
            {"id": "s2", "type": "switch"},
            {"id": "s3", "type": "switch"},
            {"id": "s4", "type": "switch"},
            {"id": "h1", "type": "host"},
            {"id": "h2", "type": "host"},
            {"id": "h3", "type": "host"},
            {"id": "h4", "type": "host"}
        ],
        "links": [
            {"source": "s1", "target": "s2"},
            {"source": "s1", "target": "s3"},
            {"source": "s4", "target": "s2"},
            {"source": "s4", "target": "s3"},
            {"source": "s1", "target": "h1"},
            {"source": "s4", "target": "h2"},
            {"source": "s3", "target": "h3"},
            {"source": "s2", "target": "h4"}
        ]
    }

import requests

def get_prometheus_metrics():
    PROM_URL = "http://localhost:9090/api/v1/query"

    query = "up"  # simple dulu

    try:
        res = requests.get(PROM_URL, params={"query": query})
        data = res.json()
        return data
    except:
        return {"error": "Prometheus tidak bisa diakses"} 

import requests

def get_ryu_topology():
    # Ambil data switch dari VM1
    response = requests.get('http://<IP-VM1>:8080/topology/switches')
    return response.json()