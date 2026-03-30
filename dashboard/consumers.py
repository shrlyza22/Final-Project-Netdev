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
        """Loop untuk mengambil data dari Ryu dan kirim ke WebSocket"""
        while self.keep_running:
            # GANTI DENGAN IP VM1 KAMU
            RYU_IP = "192.168.x.x" 
            ryu_url = f"http://{RYU_IP}:8080/stats/switches"
            
            try:
                # Gunakan loop.run_in_executor agar requests (blocking) 
                # tidak membuat WebSocket macet
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(None, requests.get, ryu_url)
                
                if response.status_code == 200:
                    data = response.json()
                    await self.send(text_data=json.dumps({
                        'type': 'topology_update',
                        'data': data
                    }))
            except Exception as e:
                print(f"Error Ryu VM1: {e}")
            
            # Update setiap 5 detik
            await asyncio.sleep(5)