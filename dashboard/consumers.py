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
        RYU_IP = "netdev1.eastasia.cloudapp.azure.com" 
        
        while self.keep_running:
            try:
                loop = asyncio.get_event_loop()
                
                # 1. Tarik Topologi Dasar (Timeout diperpanjang jadi 5 detik untuk Azure)
                sw_res = await loop.run_in_executor(None, lambda: requests.get(f"http://{RYU_IP}:8080/v1.0/topology/switches", timeout=5))
                ln_res = await loop.run_in_executor(None, lambda: requests.get(f"http://{RYU_IP}:8080/v1.0/topology/links", timeout=5))
                
                if sw_res.status_code == 200:
                    switches = sw_res.json()
                    links = ln_res.json() if ln_res.status_code == 200 else []
                    
                    # 2. 🔥 JALUR PARALEL: Ambil Flow dan Group BERSAMAAN (Anti-Lag)
                    # flow_tasks = []
                    # group_tasks = []
                    
                    # for sw in switches:
                    #     dpid = int(sw['dpid'], 16)
                    #     # Kita kumpulkan semua request jadi satu
                    #     flow_tasks.append(loop.run_in_executor(None, lambda d=dpid: requests.get(f"http://{RYU_IP}:8080/stats/flow/{d}", timeout=5)))
                    #     group_tasks.append(loop.run_in_executor(None, lambda d=dpid: requests.get(f"http://{RYU_IP}:8080/stats/group/{d}", timeout=5)))

                    # # Eksekusi semuanya secara serentak!
                    # flow_results = await asyncio.gather(*flow_tasks, return_exceptions=True)
                    # group_results = await asyncio.gather(*group_tasks, return_exceptions=True)

                    # # Bersihkan hasil (Abaikan yang error/timeout)
                    # all_flows = [r.json() for r in flow_results if not isinstance(r, Exception) and r.status_code == 200]
                    # all_groups = [r.json() for r in group_results if not isinstance(r, Exception) and r.status_code == 200]

                    # combined_data = {
                    #     'switches': switches,
                    #     'links': links,
                    #     'flows': all_flows,
                    #     'groups': all_groups  
                    # }

                    # 2. Ambil Group Stats (Satu-satunya yang kepake buat Load Balancer & Persentase)
                    group_tasks = []
                    
                    for sw in switches:
                        dpid = int(sw['dpid'], 16)
                        group_tasks.append(loop.run_in_executor(None, lambda d=dpid: requests.get(f"http://{RYU_IP}:8080/stats/group/{d}", timeout=5)))

                    # Eksekusi serentak!
                    group_results = await asyncio.gather(*group_tasks, return_exceptions=True)

                    # Bersihkan hasil
                    all_groups = [r.json() for r in group_results if not isinstance(r, Exception) and r.status_code == 200]

                    combined_data = {
                        'switches': switches,
                        'links': links,
                        'groups': all_groups  
                    }
                    
                    await self.send(text_data=json.dumps({
                        'type': 'topology_update',
                        'data': combined_data
                    }))
                    
            except Exception as e:
                print(f"Error Koneksi Lokal ke Azure: {e}")
            
            await asyncio.sleep(3)