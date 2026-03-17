import json
import requests

def get_topology_data():
    IP_RYU = "IP_VM1_LU" # Ganti dengan IP VM1 (Controller)
    PORT = "8080"
    
    try:
        # 1. Ambil data switches & links dari Ryu
        switches_req = requests.get(f'http://{IP_RYU}:{PORT}/v1.0/topology/switches')
        links_req = requests.get(f'http://{IP_RYU}:{PORT}/v1.0/topology/links')
        
        switches = switches_req.json()
        links_raw = links_req.json()

        # 2. Format ulang ke bentuk yang dimengerti D3.js (Nodes & Links)
        nodes = []
        for s in switches:
            nodes.append({"id": f"s{int(s['dpid'], 16)}", "type": "switch"})
            
        # Tips: Lu bisa tambahin host manual atau via scan ARP
        # Untuk sementara, fokus ke Switch dulu biar aman
        
        links = []
        for l in links_raw:
            links.append({
                "source": f"s{int(l['src']['dpid'], 16)}", 
                "target": f"s{int(l['dst']['dpid'], 16)}"
            })

        return {"nodes": nodes, "links": links}
    
    except Exception as e:
        print(f"Error connecting to Ryu: {e}")
        # Fallback ke dummy data kalau Ryu mati biar web gak error
        return {
            "nodes": [{"id": "s1", "type": "switch"}, {"id": "s2", "type": "switch"}],
            "links": [{"source": "s1", "target": "s2"}]
        }