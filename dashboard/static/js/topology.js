// 1. Inisialisasi - Gunakan Selector id topo-svg sesuai HTML terbaru
const topoContainer = document.getElementById("topo-container");
const svg = d3.select("#topo-svg");

let width = topoContainer.clientWidth;
let height = 500; 

// 2. Setup Simulasi Gaya (Force Simulation)
const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(150))
    .force("charge", d3.forceManyBody().strength(-600)) 
    .force("center", d3.forceCenter(width / 2, height / 2));

// 3. Fungsi Utama Menggambar
function drawTopology(data) {
    if (!data || !data.nodes) return;

    svg.selectAll("*").remove();

    // --- A. Gambar Garis (Links) ---
    const linkGroup = svg.append("g").attr("class", "links");
    
    const link = linkGroup.selectAll("line")
        .data(data.links)
        .enter().append("line")
        .attr("stroke", d => {

            if (d.status === "DOWN") return "#ef4444"; 
            return d.usage > 0 ? "#0a3d62" : "#94a3b8"; 
        })
        .attr("stroke-width", d => d.usage > 0 ? 5 : 2.5)
        .attr("stroke-opacity", 0.8)
        .attr("stroke-linecap", "round")
        .classed("link-flow-active", d => d.usage > 0 && d.status !== "DOWN");

    // --- B. Gambar Label Persentase di Tengah Jalur ---
    const linkText = svg.append("g")
        .selectAll("text")
        .data(data.links)
        .enter().append("text")
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .attr("fill", "#ef4444") 
        .text(d => d.usage > 0 ? d.usage + "%" : "");

    // --- C. Gambar Nodes (Bulatan) ---
    const nodeGroup = svg.append("g").attr("class", "nodes");

    const node = nodeGroup.selectAll("circle")
        .data(data.nodes)
        .enter().append("circle")
        .attr("r", d => d.type === "switch" ? 22 : 16)
        .attr("fill", d => d.type === "switch" ? "#38bdf8" : "#22c55e")
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // --- D. Label Nama (ID Node) ---
    const label = svg.append("g")
        .selectAll("text")
        .data(data.nodes)
        .enter().append("text")
        .text(d => d.id)
        .attr("dx", 28) 
        .attr("dy", 5);

    // --- E. Update Posisi (Tick) ---
    simulation.nodes(data.nodes).on("tick", () => {
        link.attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        linkText
            .attr("x", d => (d.source.x + d.target.x) / 2)
            .attr("y", d => (d.source.y + d.target.y) / 2);

        node.attr("cx", d => d.x = Math.max(30, Math.min(width - 30, d.x)))
            .attr("cy", d => d.y = Math.max(30, Math.min(height - 30, d.y)));
            
        label.attr("x", d => d.x).attr("y", d => d.y);
    });

    simulation.force("link").links(data.links);
    simulation.alpha(1).restart();
}

// 4. Integrasi WebSocket
const socket = new WebSocket('ws://' + window.location.host + '/ws/topology/');

socket.onmessage = function(event) {
    const incoming = JSON.parse(event.data);
    if (incoming.type === 'topology_update') {
        // Sekarang memproses data gabungan (switches, links, flows)
        const formattedData = formatRyuData(incoming.data);
        drawTopology(formattedData);
    }
};

// 5. 🔥 JALUR NINJA: Mapping Data Ryu (Switch + Link + Flow Stats)
function formatRyuData(ryuJson) {
    let nodes = [];
    let links = [];

    // 1. Proses Switch Resmi
    if (ryuJson.switches && Array.isArray(ryuJson.switches)) {
        ryuJson.switches.forEach(sw => {
            nodes.push({ id: "s" + parseInt(sw.dpid, 16), type: "switch" });
        });
    }

    // 2. Proses Link Antar Switch Resmi
    if (ryuJson.links && Array.isArray(ryuJson.links)) {
        ryuJson.links.forEach(l => {
            let simUsage = Math.floor(Math.random() * 100);
            let simStatus = Math.random() > 0.1 ? "UP" : "DOWN";

            links.push({ 
                source: "s" + parseInt(l.src.dpid, 16), 
                target: "s" + parseInt(l.dst.dpid, 16),
                usage: simUsage, 
                status: simStatus
            });
        });
    }

    // 3. 🔥 EKSTRAKSI HOST DARI FLOW STATS (Jalur Ninja)
    if (ryuJson.flows && Array.isArray(ryuJson.flows)) {
        ryuJson.flows.forEach(swFlowObj => {
            // Format ryu: { "dpid_dalam_angka": [daftar_flow] }
            const dpidKey = Object.keys(swFlowObj)[0];
            const flows = swFlowObj[dpidKey];

            flows.forEach(f => {
                // Cari IP Source (ipv4_src atau nw_src)
                const srcIp = f.match.ipv4_src || f.match.nw_src;
                
                // Jika IP ditemukan dan bukan broadcast/kosong
                if (srcIp && srcIp !== "0.0.0.0") {
                    // Masukkan ke nodes jika belum terdaftar
                    if (!nodes.find(n => n.id === srcIp)) {
                        nodes.push({ id: srcIp, type: "host" });
                        // Hubungkan host ke switch tempat flow ini berada
                        links.push({
                            source: srcIp,
                            target: "s" + parseInt(dpidKey),
                            usage: 0,
                            status: "UP"
                        });
                    }
                }
            });
        });
    }

    return { nodes, links };
}

// 6. Fungsi Drag
function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}