import json


def get_topology_data():
    """
    Mengambil data topology network
    (sementara pakai dummy data)
    """

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