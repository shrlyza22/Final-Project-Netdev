# -*- coding: utf-8 -*-
from ryu.base import app_manager
from ryu.controller import ofp_event
from ryu.ofproto import ofproto_v1_3
from ryu.controller.handler import MAIN_DISPATCHER, CONFIG_DISPATCHER, set_ev_cls

class DiamondDynamicLB(app_manager.RyuApp):
    OFP_VERSIONS = [ofproto_v1_3.OFP_VERSION]

    def __init__(self, *args, **kwargs):
        super(DiamondDynamicLB, self).__init__(*args, **kwargs)
        self.datapaths = {}
        self.links = {'L12': True, 'L13': True, 'L24': True, 'L34': True}

    @set_ev_cls(ofp_event.EventOFPSwitchFeatures, CONFIG_DISPATCHER)
    def switch_features_handler(self, ev):
        dp = ev.msg.datapath
        self.datapaths[dp.id] = dp
        self.reconfigure_all()

    @set_ev_cls(ofp_event.EventOFPPortStatus, MAIN_DISPATCHER)
    def port_status_handler(self, ev):
        msg = ev.msg
        dp = msg.datapath
        ofp = dp.ofproto
        port_no = msg.desc.port_no
        reason = msg.reason

        if reason in [ofp.OFPPR_MODIFY, ofp.OFPPR_DELETE, ofp.OFPPR_ADD]:
            is_down = (msg.desc.state & ofp.OFPPS_LINK_DOWN) != 0
            changed = False

            if dp.id == 1 and port_no == 1: self.links['L12'] = not is_down; changed = True
            elif dp.id == 2 and port_no == 1: self.links['L12'] = not is_down; changed = True
            elif dp.id == 1 and port_no == 2: self.links['L13'] = not is_down; changed = True
            elif dp.id == 3 and port_no == 1: self.links['L13'] = not is_down; changed = True
            elif dp.id == 2 and port_no == 2: self.links['L24'] = not is_down; changed = True
            elif dp.id == 4 and port_no == 1: self.links['L24'] = not is_down; changed = True
            elif dp.id == 3 and port_no == 2: self.links['L34'] = not is_down; changed = True
            elif dp.id == 4 and port_no == 2: self.links['L34'] = not is_down; changed = True

            if changed:
                status_str = 'PUTUS' if is_down else 'TERSAMBUNG'
                print("ALARM: Switch {} Port {} -> {}".format(dp.id, port_no, status_str))
                self.reconfigure_all()

    def reconfigure_all(self):
        for dp in self.datapaths.values():
            self.del_flows(dp)
            self.del_groups(dp)
            self.add_table_miss(dp)
            self.install_flows(dp)

    def install_flows(self, dp):
        path_s2_ok = self.links['L12'] and self.links['L24']
        path_s3_ok = self.links['L13'] and self.links['L34']
        path_s1_ok = self.links['L12'] and self.links['L13']
        path_s4_ok = self.links['L24'] and self.links['L34']

        # Rute untuk ke Host lokal
        mapping_host = {1: '10.0.0.1', 2: '10.0.0.4', 3: '10.0.0.3', 4: '10.0.0.2'}
        self.add_flow(dp, 10, mapping_host[dp.id], 3)

        if dp.id == 1:
            # RUTE ARP KEMBALI
            if self.links['L12']: self.add_flow(dp, 10, '10.0.0.2', 1)
            elif path_s3_ok: self.add_flow(dp, 10, '10.0.0.2', 2)

            if self.links['L13']: self.add_flow(dp, 10, '10.0.0.3', 2)
            elif path_s2_ok and self.links['L34']: self.add_flow(dp, 10, '10.0.0.3', 1)
            
            if self.links['L12']: self.add_flow(dp, 10, '10.0.0.4', 1)
            elif path_s3_ok and self.links['L24']: self.add_flow(dp, 10, '10.0.0.4', 2)

            w1, w2 = (70, 30) if (path_s2_ok and path_s3_ok) else ((100, 0) if path_s2_ok else ((0, 100) if path_s3_ok else (0, 0)))
            self.add_group(dp, 1, [(w1, 1), (w2, 2)])
            self.add_lb_flow(dp, '10.0.0.1', '10.0.0.2', 1)

        elif dp.id == 4:
            # RUTE ARP KEMBALI
            if self.links['L24']: self.add_flow(dp, 10, '10.0.0.1', 1)
            elif path_s3_ok: self.add_flow(dp, 10, '10.0.0.1', 2)

            if self.links['L34']: self.add_flow(dp, 10, '10.0.0.3', 2)
            elif path_s2_ok and self.links['L13']: self.add_flow(dp, 10, '10.0.0.3', 1)
            
            if self.links['L24']: self.add_flow(dp, 10, '10.0.0.4', 1)
            elif path_s3_ok and self.links['L12']: self.add_flow(dp, 10, '10.0.0.4', 2)

            w1, w2 = (70, 30) if (path_s2_ok and path_s3_ok) else ((100, 0) if path_s2_ok else ((0, 100) if path_s3_ok else (0, 0)))
            self.add_group(dp, 1, [(w1, 1), (w2, 2)])
            self.add_lb_flow(dp, '10.0.0.2', '10.0.0.1', 1)

        elif dp.id == 2:
            if self.links['L12']: self.add_flow(dp, 10, '10.0.0.1', 1)
            elif path_s4_ok and self.links['L13']: self.add_flow(dp, 10, '10.0.0.1', 2)
            
            if self.links['L24']: self.add_flow(dp, 10, '10.0.0.2', 2)
            elif path_s1_ok and self.links['L34']: self.add_flow(dp, 10, '10.0.0.2', 1)

            # RUTE ARP KEMBALI
            if path_s1_ok: self.add_flow(dp, 10, '10.0.0.3', 1)
            elif path_s4_ok: self.add_flow(dp, 10, '10.0.0.3', 2)

            w1, w2 = (50, 50) if (path_s1_ok and path_s4_ok) else ((100, 0) if path_s1_ok else ((0, 100) if path_s4_ok else (0, 0)))
            self.add_group(dp, 2, [(w1, 1), (w2, 2)])
            self.add_lb_flow(dp, '10.0.0.4', '10.0.0.3', 2)

        elif dp.id == 3:
            if self.links['L13']: self.add_flow(dp, 10, '10.0.0.1', 1)
            elif path_s4_ok and self.links['L12']: self.add_flow(dp, 10, '10.0.0.1', 2)

            if self.links['L34']: self.add_flow(dp, 10, '10.0.0.2', 2)
            elif path_s1_ok and self.links['L24']: self.add_flow(dp, 10, '10.0.0.2', 1)

            # RUTE ARP KEMBALI
            if path_s1_ok: self.add_flow(dp, 10, '10.0.0.4', 1)
            elif path_s4_ok: self.add_flow(dp, 10, '10.0.0.4', 2)

            w1, w2 = (50, 50) if (path_s1_ok and path_s4_ok) else ((100, 0) if path_s1_ok else ((0, 100) if path_s4_ok else (0, 0)))
            self.add_group(dp, 2, [(w1, 1), (w2, 2)])
            self.add_lb_flow(dp, '10.0.0.3', '10.0.0.4', 2)

    def add_table_miss(self, dp):
        psr = dp.ofproto_parser
        match = psr.OFPMatch()
        actions = [psr.OFPActionOutput(dp.ofproto.OFPP_CONTROLLER, dp.ofproto.OFPCML_NO_BUFFER)]
        inst = [psr.OFPInstructionActions(dp.ofproto.OFPIT_APPLY_ACTIONS, actions)]
        self.send_flow_mod(dp, 0, match, inst)

    @set_ev_cls(ofp_event.EventOFPPacketIn, MAIN_DISPATCHER)
    def packet_in_handler(self, ev):
        pass 

    def add_lb_flow(self, dp, src_ip, dst_ip, group_id):
        psr = dp.ofproto_parser
        match = psr.OFPMatch(eth_type=0x0800, ipv4_src=src_ip, ipv4_dst=dst_ip)
        inst = [psr.OFPInstructionActions(dp.ofproto.OFPIT_APPLY_ACTIONS, [psr.OFPActionGroup(group_id)])]
        self.send_flow_mod(dp, 20, match, inst)

    def add_flow(self, dp, priority, ip, port):
        psr = dp.ofproto_parser
        for eth in [0x0800, 0x0806]: 
            match = psr.OFPMatch(eth_type=eth, ipv4_dst=ip) if eth==0x0800 else psr.OFPMatch(eth_type=eth, arp_tpa=ip)
            actions = [
                psr.OFPActionOutput(port),
                psr.OFPActionOutput(dp.ofproto.OFPP_CONTROLLER) 
            ]
            inst = [psr.OFPInstructionActions(dp.ofproto.OFPIT_APPLY_ACTIONS, actions)]
            self.send_flow_mod(dp, priority, match, inst)

    def send_flow_mod(self, dp, priority, match, inst):
        mod = dp.ofproto_parser.OFPFlowMod(datapath=dp, priority=priority, match=match, instructions=inst)
        dp.send_msg(mod)

    def add_group(self, dp, group_id, buckets):
        psr = dp.ofproto_parser
        ofp_buckets = []
        for weight, port in buckets:
            ofp_buckets.append(psr.OFPBucket(weight=weight, watch_port=port, actions=[psr.OFPActionOutput(port)]))
        req = psr.OFPGroupMod(dp, dp.ofproto.OFPGC_ADD, dp.ofproto.OFPGT_SELECT, group_id, ofp_buckets)
        dp.send_msg(req)

    def del_flows(self, dp):
        mod = dp.ofproto_parser.OFPFlowMod(datapath=dp, command=dp.ofproto.OFPFC_DELETE, out_port=dp.ofproto.OFPP_ANY, out_group=dp.ofproto.OFPG_ANY, match=dp.ofproto_parser.OFPMatch())
        dp.send_msg(mod)

    def del_groups(self, dp):
        mod = dp.ofproto_parser.OFPGroupMod(dp, dp.ofproto.OFPGC_DELETE, 0, dp.ofproto.OFPG_ALL)
        dp.send_msg(mod)
