// 1. Inisialisasi - Gunakan Selector yang konsisten dengan CSS (topo-container)
const topoContainer = document.getElementById("topo-container");
const svg = d3.select("#topo-svg");

// Ukuran container dinamis
let width = topoContainer.clientWidth;
let height = 500; 

// 2. Setup Simulasi Gaya (Force Simulation)
const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(150)) // Jarak antar node
    .force("charge", d3.forceManyBody().strength(-500))        // Saling tolak menolak
    .force("center", d3.forceCenter(width / 2, height / 2));

// 3. Fungsi Utama Menggambar
function drawTopology(data) {
    if (!data || !data.nodes) return;

    // Bersihkan SVG sebelum gambar ulang
    svg.selectAll("*").remove();

    // A. Gambar Garis (Links)
    const link = svg.append("g")
        .selectAll("line")
        .data(data.links)
        .enter().append("line")
        .attr("stroke", d => {
            if (d.status === "DOWN") return "#ef4444"; // Merah jika mati
            if (d.usage > 0) return "#22c55e";        // Hijau jika ada trafik aktif
            return "#94a3b8";                          // Abu-abu jika standby/idle
            })
        .attr("stroke-width", d => d.usage > 0 ? 4 : 2) // Garis lebih tebal kalau aktif
        .attr("stroke-opacity", 0.8);
            

    // B. Gambar Nodes (Bulatan)
    const node = svg.append("g")
        .selectAll("circle")
        .data(data.nodes)
        .enter().append("circle")
        .attr("r", d => d.type === "switch" ? 22 : 16)
        .attr("fill", d => d.type === "switch" ? "#38bdf8" : "#22c55e") // Accent Blue vs Green
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // C. Label Nama (ID Node)
    const label = svg.append("g")
        .selectAll("text")
        .data(data.nodes)
        .enter().append("text")
        .text(d => d.id)
        .attr("font-size", "12px")
        .attr("font-family", "Inter, sans-serif")
        .attr("fill", "#f1f5f9")
        .attr("font-weight", "bold")
        .attr("dx", 25)
        .attr("dy", 4);

    // D. Update Posisi tiap detik simulasi (Tick)
    simulation.nodes(data.nodes).on("tick", () => {
        link.attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        // Bounding Box agar node tidak lari keluar container
        node.attr("cx", d => d.x = Math.max(30, Math.min(width - 30, d.x)))
            .attr("cy", d => d.y = Math.max(30, Math.min(height - 30, d.y)));
            
        label.attr("x", d => d.x).attr("y", d => d.y);
    });

    simulation.force("link").links(data.links);
    simulation.alpha(1).restart();
}

// 4. Integrasi WebSocket - Perbaikan URL (Hapus $)
const socket = new WebSocket('ws://' + window.location.host + '/ws/topology/');

socket.onmessage = function(event) {
    const incoming = JSON.parse(event.data);
    console.log("WS Data Received:", incoming);
    
    if (incoming.type === 'topology_update') {
        // Format data Ryu ke format D3
        const formattedData = formatRyuData(incoming.data);
        drawTopology(formattedData);
    }
};

socket.onclose = function(e) {
    console.error('Koneksi WebSocket ke Controller Terputus!')
};

// 5. Fungsi Helper Mapping Data Ryu - Perbaikan Parsing HEX ke ID s1, s2
function formatRyuData(ryuJson) {
    let nodes = [];
    let links = [];

    console.log("Raw Ryu Data:", ryuJson); // Tambahkan ini di awal fungsi formatRyuData
    // Jika datang dari endpoint /switches
    if (ryuJson.switches && Array.isArray(ryuJson.switches)) {
        ryuJson.switches.forEach(sw => {
            // Konversi dpid hex ke integer (contoh: "00000001" -> 1 -> "s1")
            nodes.push({ id: "s" + parseInt(sw.dpid, 16), type: "switch" });
        });
    }

    // Jika datang dari endpoint /links
    if (ryuJson.links && Array.isArray(ryuJson.links)) {
        ryuJson.links.forEach(l => {
            links.push({ 
                source: "s" + parseInt(l.src.dpid, 16), 
                target: "s" + parseInt(l.dst.dpid, 16) 
            });
        });
    }

    // Fallback jika formatnya berbeda (Simple list dpid)
    if (nodes.length === 0 && Array.isArray(ryuJson)) {
        ryuJson.forEach(dpid => {
            nodes.push({ id: "s" + parseInt(dpid, 16), type: "switch" });
        });
    }

    return { nodes, links };
}

// 6. Fungsi Drag (Wajib untuk interaktivitas)
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
