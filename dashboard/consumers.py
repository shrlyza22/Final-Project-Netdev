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
                
                # 1. Ambil data Switch & Link (Jalur Resmi)
                sw_res = await loop.run_in_executor(None, lambda: requests.get(f"http://{RYU_IP}:8080/v1.0/topology/switches", timeout=2))
                ln_res = await loop.run_in_executor(None, lambda: requests.get(f"http://{RYU_IP}:8080/v1.0/topology/links", timeout=2))
                
                if sw_res.status_code == 200 and ln_res.status_code == 200:
                    switches = sw_res.json()
                    links = ln_res.json()
                    
                    # 2. 🔥 JALUR NINJA: Ambil Flow Stats untuk deteksi Host
                    # Kita looping setiap switch yang ada untuk ambil table flow-nya
                    all_flows = []
                    for sw in switches:
                        dpid = sw['dpid']
                        # Nembak endpoint stats flow per switch
                        f_res = await loop.run_in_executor(None, lambda: requests.get(f"http://{RYU_IP}:8080/stats/flow/{int(dpid, 16)}", timeout=2))
                        if f_res.status_code == 200:
                            all_flows.append(f_res.json())

                    # 3. Gabungkan data
                    combined_data = {
                        'switches': switches,
                        'links': links,
                        'flows': all_flows  # Kita kirim data flow mentah ke frontend
                    }
                    
                    await self.send(text_data=json.dumps({
                        'type': 'topology_update',
                        'data': combined_data
                    }))
                    
            except Exception as e:
                print(f"Error Jalur Ninja (Flow Stats): {e}")
            
            await asyncio.sleep(5)