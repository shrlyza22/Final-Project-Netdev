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
        # RYU_IP = "netdev1.eastasia.cloudapp.azure.com" # Untuk dari local laptop narik data ke Azure
        RYU_IP = "localhost" # Untuk dari Azure langsung
        
        while self.keep_running:
            try:
                loop = asyncio.get_event_loop()
                
                # 1. Tarik Topologi Dasar (Timeout diperpanjang jadi 5 detik untuk Azure)
                sw_res = await loop.run_in_executor(None, lambda: requests.get(f"http://{RYU_IP}:8080/v1.0/topology/switches", timeout=5))
                ln_res = await loop.run_in_executor(None, lambda: requests.get(f"http://{RYU_IP}:8080/v1.0/topology/links", timeout=5))
                
                if sw_res.status_code == 200:
                    switches = sw_res.json()
                    links = ln_res.json() if ln_res.status_code == 200 else []

                    # 2. Ambil Group Stats (Satu-satunya yang kepake buat Load Balancer & Persentase)
                    group_tasks = []
                    portdesc_tasks = [] # <-- Tambahan buat ngecek kabel Host putus/nyambung
                    
                    for sw in switches:
                        dpid = int(sw['dpid'], 16)
                        group_tasks.append(loop.run_in_executor(None, lambda d=dpid: requests.get(f"http://{RYU_IP}:8080/stats/group/{d}", timeout=5)))
                        portdesc_tasks.append(loop.run_in_executor(None, lambda d=dpid: requests.get(f"http://{RYU_IP}:8080/stats/portdesc/{d}", timeout=5)))

                    # Eksekusi serentak!
                    group_results = await asyncio.gather(*group_tasks, return_exceptions=True)
                    portdesc_results = await asyncio.gather(*portdesc_tasks, return_exceptions=True)

                    # Bersihkan hasil
                    all_groups = [r.json() for r in group_results if not isinstance(r, Exception) and r.status_code == 200]
                    all_portdescs = [r.json() for r in portdesc_results if not isinstance(r, Exception) and r.status_code == 200]

                    combined_data = {
                        'switches': switches,
                        'links': links,
                        'groups': all_groups,
                        'portdescs': all_portdescs # <-- Data kabel dikirim ke Frontend
                    }
                    
                    await self.send(text_data=json.dumps({
                        'type': 'topology_update',
                        'data': combined_data
                    }))
                    
            except Exception as e:
                print(f"Error Koneksi Lokal ke Azure: {e}")

                # 🔥 TAMBAHANNYA DI SINI 🔥
                # Kasih tau frontend kalau Ryu mati dengan ngirim array kosong
                empty_data = {
                    'switches': [],
                    'links': [],
                    'flows': [],
                    'groups': []
                }
                
                # Biar aman, pake try-except lagi khusus untuk ngirim pesan error via websocket
                try:
                    await self.send(text_data=json.dumps({
                        'type': 'topology_update',
                        'data': empty_data
                    }))
                except Exception as ws_e:
                    print(f"Error kirim pesan error ke Web: {ws_e}")
            
            await asyncio.sleep(3)