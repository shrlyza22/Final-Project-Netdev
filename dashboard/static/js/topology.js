// Deklarasikan di bagian paling atas file topology.js
// let currentSelectedSwitch = "s1";
let selectedSwitchId = "1";

// 1. Inisialisasi
const topoContainer = document.getElementById("topo-container");
const svg = d3.select("#topo-svg");

let width = topoContainer.clientWidth;
let height = 500;

// ✅ Simpan snapshot data terakhir untuk perbandingan struktur
let lastDataSnapshot = null;

// 2. Setup Simulasi Gaya (Force Simulation)
const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(150))
    .force("charge", d3.forceManyBody().strength(-600))
    .force("center", d3.forceCenter(width / 2, height / 2));

// 3. Fungsi Utama Menggambar (HANYA DIPANGGIL SEKALI / JIKA ADA NODE BARU)
function drawTopology(data) {
    if (!data || !data.nodes) return;

    svg.selectAll("*").remove();

    // --- A. Gambar Garis (Links) ---
    const linkGroup = svg.append("g").attr("class", "links");

    const link = linkGroup.selectAll("line")
        .data(data.links)
        .enter().append("line")
        .attr("stroke", d => {
            if (d.status === "DOWN") return "#ef4444"; // Merah jika DOWN (Kabel putus)
            return d.usage > 0 ? "#0a3d62" : "#94a3b8"; // Biru jika Aktif, Abu-abu jika Idle
        })
        .attr("stroke-width", d => d.usage > 0 ? 5 : 2.5)
        .attr("stroke-opacity", 0.8)
        .attr("stroke-linecap", "round")
        .classed("link-flow-active", d => d.usage > 0 && d.status !== "DOWN"); // Animasi listrik

    // --- B. Label Persentase/Bucket ---
    const linkTextGroup = svg.append("g").attr("class", "link-labels");

    const linkText = linkTextGroup.selectAll("text")
        .data(data.links)
        .enter().append("text")
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .attr("fill", "#ef4444")
        .text(d => d.label ? d.label : (d.usage > 0 ? d.usage + "%" : ""));
   
    // --- C. Gambar Nodes (Switch/Host) ---
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

    const labelGroup = svg.append("g").attr("class", "node-labels");
    const label = labelGroup.selectAll("text")
        .data(data.nodes)
        .enter().append("text")
        .text(d => d.id)
        .attr("dx", 28)
        .attr("dy", 5);

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

// ✅ FUNGSI BARU: Update warna/animasi secara Live tanpa hapus gambar
function updateTopologyData(data) {
    svg.select(".links").selectAll("line")
        .data(data.links)
        .attr("stroke", d => {
            if (d.status === "DOWN") return "#ef4444"; 
            return d.usage > 0 ? "#0a3d62" : "#94a3b8"; 
        })
        .attr("stroke-width", d => d.usage > 0 ? 5 : 2.5)
        .classed("link-flow-active", d => d.usage > 0 && d.status !== "DOWN");

    svg.select(".link-labels").selectAll("text")
        .data(data.links)
        .text(d => d.label ? d.label : (d.usage > 0 ? d.usage + "%" : ""));
}

function isTopologyChanged(newData) {
    if (!lastDataSnapshot) return true; 

    const oldNodes = lastDataSnapshot.nodes.map(n => n.id).sort().join(",");
    const newNodes = newData.nodes.map(n => n.id).sort().join(",");
    if (oldNodes !== newNodes) return true;

    const serializeLinks = (links) =>
        links.map(l => {
            const src = typeof l.source === "object" ? l.source.id : l.source;
            const tgt = typeof l.target === "object" ? l.target.id : l.target;
            return `${src}->${tgt}`; 
        }).sort().join("|");

    const oldLinks = serializeLinks(lastDataSnapshot.links);
    const newLinks = serializeLinks(newData.links);
    if (oldLinks !== newLinks) return true;

    return false; 
}

// 4. Integrasi WebSocket
const socket = new WebSocket('ws://' + window.location.host + '/ws/topology/');

socket.onmessage = function(event) {
    const incoming = JSON.parse(event.data);
    if (incoming.type === 'topology_update') {
        const formattedData = formatRyuData(incoming.data);

        if (isTopologyChanged(formattedData)) {
            console.log("[Topology] Struktur berubah, gambar ulang...");
            lastDataSnapshot = formattedData;
            drawTopology(formattedData);
        } else {
            updateTopologyData(formattedData);
        }
    }
};

function formatRyuData(ryuJson) {
    let nodes = [];
    let links = [];

    if (ryuJson.switches && Array.isArray(ryuJson.switches)) {
        ryuJson.switches.forEach(sw => {
            nodes.push({ id: "s" + parseInt(sw.dpid, 16), type: "switch" });
        });
    }

    if (ryuJson.links && Array.isArray(ryuJson.links)) {
        ryuJson.links.forEach(l => {
            const srcId = "s" + parseInt(l.src.dpid, 16);
            const dstId = "s" + parseInt(l.dst.dpid, 16);

            let currentUsage = 0;

            // 🔥 LOGIKA 70/30 MENTOR 🔥
            if (srcId === "s1" && dstId === "s2") {
                currentUsage = 70; // Jalur utama 70%
            } else if (srcId === "s1" && dstId === "s3") {
                currentUsage = 30; // Jalur cadangan 30%
            } else {
                // 🔥 SISA KABEL DINOLKAN: Biar warnanya jadi Abu-abu (Idle) dan ga ada listriknya
                currentUsage = 0;
            }

            links.push({
                source: srcId,
                target: dstId,
                usage: currentUsage,
                status: l.status ?? "UP", // Kalau kabel dimatiin dari Ryu, dia otomatis jadi DOWN (Merah)
                label: currentUsage > 0 ? currentUsage + "%" : "" // Teks % cuma muncul kalo usage > 0
            });
        });
    }

    if (ryuJson.flows && Array.isArray(ryuJson.flows)) {
        ryuJson.flows.forEach(swFlowObj => {
            const dpidKey = Object.keys(swFlowObj)[0];
            const flows = swFlowObj[dpidKey];

            flows.forEach(f => {
                const srcIp = f.match.ipv4_src || f.match.nw_src;
                if (srcIp && srcIp !== "0.0.0.0") {
                    if (!nodes.find(n => n.id === srcIp)) {
                        nodes.push({ id: srcIp, type: "host" });
                        links.push({
                            source: srcIp,
                            target: "s" + parseInt(dpidKey),
                            usage: 0,
                            status: "UP",
                            label: ""
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


// Tambahkan fungsi ini di dalam dashboard/static/js/topology.js

// dashboard/static/js/topology.js

function updateLBTable(groupsData) {
    const tableBody = document.getElementById("lb-table-body");
    let activeGroup = null;

    if (groupsData && Array.isArray(groupsData)) {
        groupsData.forEach(swGroup => {
            // Mengambil key DPID (bisa berupa "1" atau "0000000000000001")
            const dpidKey = Object.keys(swGroup)[0]; 
            
            // Konversi dpidKey ke integer agar konsisten (misal "0...01" jadi 1)
            const dpidInt = parseInt(dpidKey, 16); 
            
            // Bandingkan dengan switch yang dipilih (1, 2, 3, atau 4)
            if (dpidInt === parseInt(selectedSwitchId)) {
                const groups = swGroup[dpidKey];
                if (groups && groups.length > 0) {
                    activeGroup = groups[0]; 
                }
            }
        });
    }

    // Jika data tidak ditemukan untuk switch yang dipilih, tampilkan 0
    if (!activeGroup) {
        tableBody.innerHTML = `
            <tr><td>Packet Count</td><td>0</td><td>0</td><td>0</td></tr>
            <tr><td>Byte Count</td><td>~0 GB</td><td>~0 GB</td><td>~0 GB</td></tr>
            <tr><td>Persentase Realita</td><td>0%</td><td>0%</td><td>0%</td></tr>
        `;
        return;
    }

    const b0 = activeGroup.bucket_stats[0];
    const b1 = activeGroup.bucket_stats[1];
    const totalP = activeGroup.packet_count;
    const totalB = activeGroup.byte_count;

    const p0 = ((b0.byte_count / totalB) * 100).toFixed(2);
    const p1 = ((b1.byte_count/ totalB) * 100).toFixed(2);

    tableBody.innerHTML = `
        <tr>
            <td>Packet Count</td>
            <td>${b0.packet_count.toLocaleString()}</td>
            <td>${b1.packet_count.toLocaleString()}</td>
            <td>${totalP.toLocaleString()}</td>
        </tr>
        <tr>
            <td>Byte Count</td>
            <td>~${(b0.byte_count / 1e9).toFixed(2)} GB</td>
            <td>~${(b1.byte_count / 1e9).toFixed(2)} GB</td>
            <td>~${(totalB / 1e9).toFixed(2)} GB</td>
        </tr>
        <tr>
            <td>Persentase Realita</td>
            <td>${p0}%</td>
            <td>${p1}%</td>
            <td>100%</td>
        </tr>
    `;
}


// Panggil fungsi di dalam socket.onmessage
socket.onmessage = function(event) {
    const incoming = JSON.parse(event.data);
    if (incoming.type === 'topology_update') {
        // ... kode topology yang sudah ada ...
        updateLBTable(incoming.data.groups); 
    }
};


// Fungsi untuk menangani klik tombol

function changeActiveSwitch(swNum) {
    // 1. Simpan nomor switch yang dipilih ke variabel global
    selectedSwitchId = swNum.toString();
    
    // 2. Hapus kelas 'active' dari semua tombol
    document.querySelectorAll('.sw-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 3. Tambahkan kelas 'active' ke tombol yang baru saja diklik
    const activeBtn = document.getElementById(`btn-s${swNum}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // 4. Update judul label (Opsional, agar lebih jelas)
    const labelElement = document.getElementById("active-sw-label");
    if (labelElement) {
        labelElement.innerText = `(Switch ${swNum})`;
    }
    
    console.log("Menampilkan data untuk Switch:", selectedSwitchId);
}