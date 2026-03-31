import json
import asyncio
import requests
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

class TopologyConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        self.keep_running = True
        # Jalankan loop di background agar tidak memblock proses connect
        asyncio.create_task(self.send_stats_loop())

    async def disconnect(self, close_code):
        # Berhentikan loop saat user menutup tab browser
        self.keep_running = False

    async def send_stats_loop(self):
        while self.keep_running:
            RYU_IP = "10.10.10.4" # Ganti pake IP Private VM1
            
            try:
                loop = asyncio.get_event_loop()
                # Ambil data Switch
                sw_res = await loop.run_in_executor(None, requests.get, f"http://{RYU_IP}:8080/v1.0/topology/switches")
                # Ambil data Link (PENTING buat nampilin garis antar switch)
                ln_res = await loop.run_in_executor(None, requests.get, f"http://{RYU_IP}:8080/v1.0/topology/links")

                if sw_res.status_code == 200 and ln_res.status_code == 200:
                    combined_data = {
                        'switches': sw_res.json(),
                        'links': ln_res.json()
                    }
                    # Kirim ke WebSocket
                    await self.send(text_data=json.dumps({
                        'type': 'topology_update',
                        'data': combined_data
                    }))
            except Exception as e:
                print(f"Error Ryu: {e}")
            
            await asyncio.sleep(5) # Update otomatis tiap 5 detik