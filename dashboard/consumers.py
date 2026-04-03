import json
import asyncio
import requests
from channels.generic.websocket import AsyncWebsocketConsumer

class TopologyConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        self.keep_running = True
        asyncio.create_task(self.send_stats_loop())

    async def disconnect(self, close_code):
        self.keep_running = False

    async def send_stats_loop(self):
        # Ganti dengan IP Public Azure kamu kalau akses dari luar
        RYU_IP = "netdev1.eastasia.cloudapp.azure.com" 
        
        while self.keep_running:
            try:
                loop = asyncio.get_event_loop()
                
                # 1. Ambil data Switch & Link (Untuk Gambar Topologi)
                sw_res = await loop.run_in_executor(None, lambda: requests.get(f"http://{RYU_IP}:8080/v1.0/topology/switches", timeout=2))
                ln_res = await loop.run_in_executor(None, lambda: requests.get(f"http://{RYU_IP}:8080/v1.0/topology/links", timeout=2))
                
                if sw_res.status_code == 200:
                    switches = sw_res.json()
                    links = ln_res.json() if ln_res.status_code == 200 else []
                    
                    all_flows = []
                    all_groups = [] # Tambahkan list untuk menampung data Group/Bucket

                    for sw in switches:
                        dpid_hex = sw['dpid']
                        dpid_int = int(dpid_hex, 16)
                        
                        # 2. Ambil Flow Stats (Untuk deteksi Host/Garis)
                        f_res = await loop.run_in_executor(None, lambda: requests.get(f"http://{RYU_IP}:8080/stats/flow/{dpid_int}", timeout=2))
                        if f_res.status_code == 200:
                            all_flows.append(f_res.json())

                        # 3. 🔥 TAMBAHAN: Ambil Group Stats (Untuk Isi Tabel Load Balancer)
                        # Ini yang akan mengambil data packet_count dan byte_count per Bucket
                        g_res = await loop.run_in_executor(None, lambda: requests.get(f"http://{RYU_IP}:8080/stats/group/{dpid_int}", timeout=2))
                        if g_res.status_code == 200:
                            all_groups.append(g_res.json())

                    # 4. Gabungkan semua data untuk dikirim ke Frontend
                    combined_data = {
                        'switches': switches,
                        'links': links,
                        'flows': all_flows,
                        'groups': all_groups  # Data ini yang akan dibaca oleh fungsi updateLBTable di JS
                    }
                    
                    await self.send(text_data=json.dumps({
                        'type': 'topology_update',
                        'data': combined_data
                    }))
                    
            except Exception as e:
                print(f"Error Update Data Ryu: {e}")
            
            # Anda bisa mempercepat sleep menjadi 2 atau 3 agar tabel terasa lebih real-time
            await asyncio.sleep(3)