from mininet.topo import Topo

class DiamondTopo(Topo):
    def build(self):
        # 1. Inisialisasi Switch (S1-S4) 
        s1 = self.addSwitch('s1')
        s2 = self.addSwitch('s2')
        s3 = self.addSwitch('s3')
        s4 = self.addSwitch('s4')

        # 2. Inisialisasi Host (H1-H4)
        h1 = self.addHost('h1', ip='10.0.0.1')
        h2 = self.addHost('h2', ip='10.0.0.2')
        h3 = self.addHost('h3', ip='10.0.0.3')
        h4 = self.addHost('h4', ip='10.0.0.4')

        # 3. Hubungkan Host ke Switch
        self.addLink(s1, h1, port1=3) # S1-P3 ke H1
        self.addLink(s4, h2, port1=3) # S4-P3 ke H2
        self.addLink(s3, h3, port1=3) # S3-P3 ke H3
        self.addLink(s2, h4, port1=3) # S2-P3 ke H4

        # 4. Hubungkan antar Switch
        # Link dari S1 (Top)
        self.addLink(s1, s2, port1=1, port2=1) # S1-P1 ke S2-P1 (Jalur 70%)
        self.addLink(s1, s3, port1=2, port2=1) # S1-P2 ke S3-P1 (Jalur 30%)
        
        # Link dari S4 (Bottom)
        self.addLink(s4, s2, port1=1, port2=2) # S4-P1 ke S2-P2
        self.addLink(s4, s3, port1=2, port2=2) # S4-P2 ke S3-P2

topos = {'diamond': (lambda: DiamondTopo())}
