import time
import requests
from prometheus_client import start_http_server, Gauge

SWITCH_COUNT = Gauge('ryu_switches_connected', 'Number of connected switches')
PORT_RX = Gauge('ryu_port_rx_bytes', 'Received bytes per port', ['dpid', 'port'])
PORT_ERR = Gauge('ryu_port_rx_errors', 'Received errors per port', ['dpid', 'port'])
FLOW_COUNT = Gauge('ryu_flow_stats_count', 'Number of flow entries per switch', ['dpid'])
LATENCY = Gauge('ryu_controller_latency_seconds', 'Ryu REST API response time in seconds')

RYU_URL = "http://localhost:8080"

def collect():
    # BLOK 1: Hitung Latency & Jumlah Switch
    try:
        start_time = time.time()
        sw_resp = requests.get(f"{RYU_URL}/stats/switches", timeout=2)
        sw = sw_resp.json()
        LATENCY.set(time.time() - start_time)
        SWITCH_COUNT.set(len(sw))
    except Exception as e:
        print(f"Error API Switch: {e}")
        return # Hentikan kalau controller mati

    # Eksekusi per Switch
    for d in sw:
        d_str = str(d)
        
        # BLOK 2: Tarik Port Stats (Aman dari TypeError)
        try:
            p_resp = requests.get(f"{RYU_URL}/stats/port/{d}", timeout=2)
            p_stats = p_resp.json()
            if d_str in p_stats:
                for s in p_stats[d_str]:
                    p_no = str(s.get('port_no', 'unknown'))
                    # Filter aman menggunakan string matching, abaikan local port
                    if p_no != 'LOCAL' and p_no != '4294967294':
                        PORT_RX.labels(dpid=d_str, port=p_no).set(s.get('rx_bytes', 0))
                        PORT_ERR.labels(dpid=d_str, port=p_no).set(s.get('rx_errors', 0))
        except Exception as e:
            print(f"Error Port Stats DPID {d}: {e}")

        # BLOK 3: Tarik Flow Stats
        try:
            f_resp = requests.get(f"{RYU_URL}/stats/flow/{d}", timeout=2)
            f_stats = f_resp.json()
            if d_str in f_stats:
                FLOW_COUNT.labels(dpid=d_str).set(len(f_stats[d_str]))
        except Exception as e:
            print(f"Error Flow Stats DPID {d}: {e}")

if __name__ == '__main__':
    start_http_server(7979)
    print("Exporter v2 running - Fault Tolerant Mode")
    while True:
        collect()
        time.sleep(2)
