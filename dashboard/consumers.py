import json
import asyncio
import requests
import paramiko
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
        RYU_IP = "10.10.10.4" # Untuk dari Azure langsung
        
        while self.keep_running:
            try:
                loop = asyncio.get_event_loop()
                
                # 1. Tarik Topologi Dasar
                sw_res = await loop.run_in_executor(None, lambda: requests.get(f"http://{RYU_IP}:8080/v1.0/topology/switches", timeout=5))
                ln_res = await loop.run_in_executor(None, lambda: requests.get(f"http://{RYU_IP}:8080/v1.0/topology/links", timeout=5))
                
                if sw_res.status_code == 200:
                    switches = sw_res.json()
                    links = ln_res.json() if ln_res.status_code == 200 else []

                    # 2. Ambil Group Stats
                    group_tasks = []
                    portdesc_tasks = [] 
                    
                    for sw in switches:
                        dpid = int(sw['dpid'], 16)
                        group_tasks.append(loop.run_in_executor(None, lambda d=dpid: requests.get(f"http://{RYU_IP}:8080/stats/group/{d}", timeout=5)))
                        portdesc_tasks.append(loop.run_in_executor(None, lambda d=dpid: requests.get(f"http://{RYU_IP}:8080/stats/portdesc/{d}", timeout=5)))

                    group_results = await asyncio.gather(*group_tasks, return_exceptions=True)
                    portdesc_results = await asyncio.gather(*portdesc_tasks, return_exceptions=True)

                    all_groups = [r.json() for r in group_results if not isinstance(r, Exception) and r.status_code == 200]
                    all_portdescs = [r.json() for r in portdesc_results if not isinstance(r, Exception) and r.status_code == 200]

                    combined_data = {
                        'switches': switches,
                        'links': links,
                        'groups': all_groups,
                        'portdescs': all_portdescs
                    }
                    
                    await self.send(text_data=json.dumps({
                        'type': 'topology_update',
                        'data': combined_data
                    }))
                    
            except Exception as e:
                print(f"Error Koneksi Lokal ke Azure: {e}")
                empty_data = {
                    'switches': [],
                    'links': [],
                    'groups': []
                }
                
                try:
                    await self.send(text_data=json.dumps({
                        'type': 'topology_update',
                        'data': empty_data
                    }))
                except Exception as ws_e:
                    print(f"Error kirim pesan error ke Web: {ws_e}")
            
            await asyncio.sleep(3)

    # 1. Fungsi untuk menerima pesan klik dari topology.js
    async def receive(self, text_data):
        data = json.loads(text_data)

        if data.get('action') == 'toggle_switch':
            target_switch = data['dpid'] # contoh dapet 's1'
            target_state = data['target_state'] # dapet 'down' atau 'up'

            print(f"Menerima perintah: {target_state} untuk {target_switch}")

            # Eksekusi SSH di background agar tidak bikin WebSocket ngelag
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: self.execute_mininet_command(target_switch, target_state))

    # 2. Fungsi untuk Remote SSH ke VM2 pakai file .pem
    def execute_mininet_command(self, switch_id, state):
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

            # Pastikan IP dan path kunci lu bener
            # VM2_IP = "netdev2.eastasia.cloudapp.azure.com"
            VM2_IP = "10.10.10.5"  
            VM2_USER = "netdev2" 
            # PEM_FILE = r"C:\Users\Hp\Downloads\Netdev-key.pem" 

            print(f"Mencoba SSH ke {VM2_IP}...")
            ssh.connect(hostname=VM2_IP, username=VM2_USER, timeout=5.0)

            if state == "down":
                # Hapus sw dari controller
                command = f"sudo ovs-vsctl del-controller {switch_id} && sudo ovs-ofctl -O OpenFlow13 del-flows {switch_id}"
            else:
                command = f"CTRL=$(sudo ovs-vsctl show | grep -o 'tcp:[0-9\\.]*:[0-9]*' | head -n 1) && sudo ovs-vsctl set-controller {switch_id} $CTRL"

            # Eksekusi command di VM2
            stdin, stdout, stderr = ssh.exec_command(command)

            err_msg = stderr.read().decode().strip()
            if err_msg:
                print(f"Peringatan dari OVS VM2: {err_msg}")
            else:
                print(f"Sukses eksekusi di VM2. Switch {switch_id} berhasil di-{state.upper()}!")
                
            ssh.close()

        except Exception as e:
            print(f"GAGAL SSH ke VM2: Cek IP, path file .pem, atau koneksi. Detail Error: {e}")