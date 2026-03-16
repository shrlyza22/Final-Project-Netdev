import json
import requests

def get_topology_data():
    """
    Mengambil data topology network
    (sementara pakai dummy data)
    """


    # Ini nanti dipake pas VM1 temen lo udah nyala
    # IP_RYU = "192.168.x.x" (IP VM temen lo)
    try:
        # Contoh API Ryu untuk ambil list switch
        # response = requests.get(f'http://{IP_RYU}:8080/stats/switches')
        # return response.json()
        pass
    except:
        return None

    data = {
        "nodes": [
            {"id": "s1", "type": "switch"},
            {"id": "s2", "type": "switch"},
            {"id": "h1", "type": "host"},
            {"id": "h2", "type": "host"}
        ],
        "links": [
            {"source": "s1", "target": "s2"},
            {"source": "s1", "target": "h1"},
            {"source": "s2", "target": "h2"}
        ]
    }

    return data