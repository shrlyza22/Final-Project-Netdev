// 1. Inisialisasi - Pastikan hanya memilih SVG di dalam container khusus
const topoContainer = document.getElementById("topo-container");
const svg = d3.select("#topo-container svg");

// Gunakan ukuran container, jangan gunakan window.innerHeight!
let width = topoContainer.clientWidth;
let height = 500; // Tinggi statis agar halaman tetap bisa di-scroll

// 2. Setup Simulasi Gaya
const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(120))
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(width / 2, height / 2));

// 3. Fungsi Utama Menggambar
function drawTopology(data) {
    // Validasi data agar tidak error jika data kosong
    if (!data || !data.nodes) return;

    // Bersihkan SVG setiap kali update (Hanya di dalam SVG ini)
    svg.selectAll("*").remove();

    // A. Gambar Garis (Links)
    const link = svg.append("g")
        .selectAll("line")
        .data(data.links)
        .enter().append("line")
        .attr("stroke", "#bdc3c7")
        .attr("stroke-width", 2);

    // B. Gambar Nodes (Bulatan)
    const node = svg.append("g")
        .selectAll("circle")
        .data(data.nodes)
        .enter().append("circle")
        .attr("r", d => d.type === "switch" ? 20 : 14)
        .attr("fill", d => d.type === "switch" ? "#3498db" : "#2ecc71")
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // C. Label Nama
    const label = svg.append("g")
        .selectAll("text")
        .data(data.nodes)
        .enter().append("text")
        .text(d => d.id)
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("dx", 22)
        .attr("dy", 4);

    // D. Update Posisi (Tick)
    simulation.nodes(data.nodes).on("tick", () => {
        link.attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        // Bounding Box: Paksa node tetap di dalam kotak (width & height container)
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
    try {
        const incomingData = JSON.parse(event.data);
        console.log("📥 Live Update dari Ryu:", incomingData.data);
        
        // Pastikan fungsi helper format data dipanggil
        const formattedData = formatRyuData(incomingData.data);
        drawTopology(formattedData);
    } catch (err) {
        console.error("Gagal memproses data WebSocket:", err);
    }
};

// 5. Fungsi Helper Mapping Data Ryu
function formatRyuData(ryuJson) {
    let nodes = [];
    let links = [];

    // Jika formatnya list dpid [1, 2, 3]
    if (Array.isArray(ryuJson)) {
        ryuJson.forEach(dpid => {
            nodes.push({ id: "s" + dpid, type: "switch" });
        });
    } 
    // Jika formatnya object lengkap (switches & links)
    else if (ryuJson.switches) {
        ryuJson.switches.forEach(sw => nodes.push({ id: "s" + sw.dpid, type: "switch" }));
        if (ryuJson.links) {
            ryuJson.links.forEach(l => links.push({ source: "s" + l.src.dpid, target: "s" + l.dst.dpid }));
        }
    }

    return { nodes, links };
}

// Drag Functions (Wajib ada agar tidak error)
function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
}
function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; d.fy = null;
}