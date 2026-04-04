// 1. Variabel Global
let selectedSwitchId = "1";
const topoContainer = document.getElementById("topo-container");
const svg = d3.select("#topo-svg");

let width = topoContainer.clientWidth;
let height = 500;
let lastDataSnapshot = null;

// 2. Setup Simulasi (velocityDecay tinggi biar anteng)
const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(150))
    .force("charge", d3.forceManyBody().strength(-700))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .velocityDecay(0.6); 

// 3. Fungsi Menggambar (Hanya saat struktur berubah)
function drawTopology(data) {
    if (!data || !data.nodes) return;
    svg.selectAll("*").remove();

    // Grouping agar rapi
    const linkGroup = svg.append("g").attr("class", "links-layer");
    const nodeGroup = svg.append("g").attr("class", "nodes-layer");

    // A. Links
    const link = linkGroup.selectAll("line")
        .data(data.links)
        .enter().append("line")
        .attr("stroke", d => (d.status === "DOWN" ? "#ef4444" : (d.usage > 0 ? "#0a3d62" : "#94a3b8")))
        .attr("stroke-width", d => (d.usage > 0 ? 5 : 2.5))
        .attr("stroke-opacity", 0.8)
        .classed("link-flow-active", d => d.usage > 0 && d.status !== "DOWN");

    // B. Link Labels
    const linkText = svg.append("g").attr("class", "link-labels")
        .selectAll("text").data(data.links)
        .enter().append("text")
        .attr("font-size", "11px").attr("font-weight", "bold").attr("fill", "#ef4444");

    // C. Nodes
    const node = nodeGroup.selectAll("circle")
        .data(data.nodes)
        .enter().append("circle")
        .attr("r", d => (d.type === "switch" ? 22 : 16))
        .attr("fill", d => (d.type === "switch" ? "#38bdf8" : "#22c55e"))
        .attr("stroke", "#fff").attr("stroke-width", 2)
        .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

    // D. Node Labels
    const label = svg.append("g").attr("class", "node-labels")
        .selectAll("text").data(data.nodes)
        .enter().append("text")
        .text(d => d.id).attr("dx", 28).attr("dy", 5);

    // E. TICK SIMULATION (Update Posisi)
    simulation.nodes(data.nodes).on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x).attr("y2", d => d.target.y);

        linkText.attr("x", d => (d.source.x + d.target.x) / 2)
                .attr("y", d => (d.source.y + d.target.y) / 2)
                .text(d => d.label || (d.usage > 0 ? d.usage + "%" : ""));

        node.attr("cx", d => d.x = Math.max(30, Math.min(width - 30, d.x)))
            .attr("cy", d => d.y = Math.max(30, Math.min(height - 30, d.y)));

        label.attr("x", d => d.x).attr("y", d => d.y);
    });

    simulation.force("link").links(data.links);
    simulation.alpha(1).restart();
}

// 4. Update Visual (Hanya update atribut, BUKAN koordinat)
function updateTopologyVisuals() {
    if (!lastDataSnapshot) return;

    svg.selectAll(".links-layer line")
        .data(lastDataSnapshot.links)
        .attr("stroke", d => (d.status === "DOWN" ? "#ef4444" : (d.usage > 0 ? "#0a3d62" : "#94a3b8")))
        .attr("stroke-width", d => (d.usage > 0 ? 5 : 2.5))
        .classed("link-flow-active", d => d.usage > 0 && d.status !== "DOWN");

    svg.selectAll(".link-labels text")
        .data(lastDataSnapshot.links)
        .text(d => d.label || (d.usage > 0 ? d.usage + "%" : ""));
}

// 6. Parsing Data Ryu (Tetap sama)
function formatRyuData(ryuJson) {
    let nodes = [];
    let groupMap = {};
    if (ryuJson.groups) {
        ryuJson.groups.forEach(g => {
            const dpid = Object.keys(g)[0];
            groupMap[parseInt(dpid, 16)] = g[dpid][0];
        });
    }
    if (ryuJson.switches) {
        ryuJson.switches.forEach(sw => nodes.push({ id: "s" + parseInt(sw.dpid, 16), type: "switch" }));
    }

    let uniqueLinks = {};
    if (ryuJson.links) {
        ryuJson.links.forEach(l => {
            const s = parseInt(l.src.dpid, 16), d = parseInt(l.dst.dpid, 16);
            const linkKey = `s${Math.min(s,d)}-s${Math.max(s,d)}`;
            if (!uniqueLinks[linkKey]) {
                uniqueLinks[linkKey] = { source: `s${Math.min(s,d)}`, target: `s${Math.max(s,d)}`, usage: 0, status: l.status || "UP", label: "" };
            }
        });
    }

    // --- GANTI MULAI DARI SINI ---
    let links = Object.values(uniqueLinks);

    // Otomatis mencari Switch mana yang sedang mengirim data (Load Balancing)
    Object.keys(groupMap).forEach(dpid => {
        const g = groupMap[dpid];
        
        // Cek jika switch ini punya trafik aktif
        if (g && g.byte_count > 0) {
            let b0 = ((g.bucket_stats[0].byte_count / g.byte_count) * 100).toFixed(2) + "%";
            let b1 = ((g.bucket_stats[1].byte_count / g.byte_count) * 100).toFixed(2) + "%";

            // Skenario 1: Jika Switch 1 yang mengirim (h1 ke h2)
            if (dpid == "1") {
                let l1 = links.find(l => (l.source === "s1" && l.target === "s2") || (l.source === "s2" && l.target === "s1"));
                let l2 = links.find(l => (l.source === "s1" && l.target === "s3") || (l.source === "s3" && l.target === "s1"));
                if(l1) { l1.usage = 1; l1.label = b0; } // S1 ke S2
                if(l2) { l2.usage = 1; l2.label = b1; } // S1 ke S3
            }
            // Skenario 2: Jika Switch 3 yang mengirim (h3 ke h4)
            else if (dpid == "3") {
                let l1 = links.find(l => (l.source === "s1" && l.target === "s3") || (l.source === "s3" && l.target === "s1")); 
                let l2 = links.find(l => (l.source === "s3" && l.target === "s4") || (l.source === "s4" && l.target === "s3")); 
                if(l1) { l1.usage = 1; l1.label = b0; } // S3 ke S1
                if(l2) { l2.usage = 1; l2.label = b1; } // S3 ke S4
            }
            // Skenario 3: Jika Switch 4 yang mengirim (h2 ke h1)
            else if (dpid == "4") {
                let l1 = links.find(l => (l.source === "s2" && l.target === "s4") || (l.source === "s4" && l.target === "s2")); 
                let l2 = links.find(l => (l.source === "s3" && l.target === "s4") || (l.source === "s4" && l.target === "s3")); 
                if(l1) { l1.usage = 1; l1.label = b0; } // S4 ke S2
                if(l2) { l2.usage = 1; l2.label = b1; } // S4 ke S3
            }
            // Skenario 4: Jika Switch 2 yang mengirim (h4 ke h3)
            else if (dpid == "2") {
                let l1 = links.find(l => (l.source === "s1" && l.target === "s2") || (l.source === "s2" && l.target === "s1")); 
                let l2 = links.find(l => (l.source === "s2" && l.target === "s4") || (l.source === "s4" && l.target === "s2")); 
                if(l1) { l1.usage = 1; l1.label = b0; } // S2 ke S1
                if(l2) { l2.usage = 1; l2.label = b1; } // S2 ke S4
            }
        }
    });
    // --- SAMPAI SINI ---

    const staticHosts = [{id: "h1", sw: "s1"}, {id: "h4", sw: "s2"}, {id: "h3", sw: "s3"}, {id: "h2", sw: "s4"}];
    staticHosts.forEach(h => {
        if (nodes.find(n => n.id === h.sw)) {
            nodes.push({ id: h.id, type: "host" });
            links.push({ source: h.id, target: h.sw, usage: 0, status: "UP", label: "" });
        }
    });
    return { nodes, links };
}

// 9. WebSocket (SINKRONISASI KETAT)
const socket = new WebSocket('ws://' + window.location.host + '/ws/topology/');
socket.onmessage = function(event) {
    const incoming = JSON.parse(event.data);
    if (incoming.type === 'topology_update') {
        const newData = formatRyuData(incoming.data);

        // Kalau baru load atau jumlah switch berubah -> Gambar ulang total
        if (!lastDataSnapshot || lastDataSnapshot.nodes.length !== newData.nodes.length) {
            lastDataSnapshot = newData;
            drawTopology(newData);
        } else {
            // FIX: Jangan replace object. Cukup update properti visualnya saja!
            newData.links.forEach(newLink => {
                const oldLink = lastDataSnapshot.links.find(ol => 
                    (typeof ol.source === 'object' ? ol.source.id : ol.source) === newLink.source &&
                    (typeof ol.target === 'object' ? ol.target.id : ol.target) === newLink.target
                );
                
                if (oldLink) {
                    // Update atribut tanpa menyentuh object .source dan .target milik D3
                    oldLink.usage = newLink.usage;
                    oldLink.status = newLink.status;
                    oldLink.label = newLink.label;
                }
            });

            // HAPUS BARIS INI: lastDataSnapshot = newData;
            
            // Panggil update visual
            updateTopologyVisuals();
        }
        
        if(incoming.data.groups) updateLBTable(incoming.data.groups);
    }
};

// 10. Drag & Table Helpers (Standard)
function dragstarted(event, d) { if (!event.active) simulation.alphaTarget(0.1).restart(); d.fx = d.x; d.fy = d.y; }
function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }
function updateLBTable(groupsData) {
    const tableBody = document.getElementById("lb-table-body");
    let active = null;
    groupsData.forEach(g => { const dpid = Object.keys(g)[0]; if (parseInt(dpid, 16) === parseInt(selectedSwitchId)) active = g[dpid][0]; });
    if (!active) return;
    const b0 = active.bucket_stats[0], b1 = active.bucket_stats[1], total = active.byte_count;
    tableBody.innerHTML = `<tr><td>Packet</td><td>${b0.packet_count}</td><td>${b1.packet_count}</td><td>${active.packet_count}</td></tr><tr><td>Byte</td><td>${(b0.byte_count/1e9).toFixed(2)} GB</td><td>${(b1.byte_count/1e9).toFixed(2)} GB</td><td>${(total/1e9).toFixed(2)} GB</td></tr><tr><td>%</td><td>${total>0?((b0.byte_count/total)*100).toFixed(2):0}%</td><td>${total>0?((b1.byte_count/total)*100).toFixed(2):0}%</td><td>100%</td></tr>`;
}
function changeActiveSwitch(swNum) { selectedSwitchId = swNum.toString(); document.querySelectorAll('.sw-btn').forEach(btn => btn.classList.remove('active')); document.getElementById(`btn-s${swNum}`).classList.add('active'); }