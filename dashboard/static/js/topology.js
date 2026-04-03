// 1. Variabel Global
let selectedSwitchId = "1";
const topoContainer = document.getElementById("topo-container");
const svg = d3.select("#topo-svg");

let width = topoContainer.clientWidth;
let height = 500;
let lastDataSnapshot = null;

// 2. Setup Simulasi Gaya (Force Simulation)
const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(150))
    .force("charge", d3.forceManyBody().strength(-600))
    .force("center", d3.forceCenter(width / 2, height / 2));

// 3. Fungsi Utama Menggambar (Hanya dipanggil jika struktur node berubah)
function drawTopology(data) {
    if (!data || !data.nodes) return;

    svg.selectAll("*").remove();

    // A. Gambar Garis (Links)
    const link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(data.links)
        .enter().append("line")
        .attr("stroke", d => (d.status === "DOWN" ? "#ef4444" : (d.usage > 0 ? "#0a3d62" : "#94a3b8")))
        .attr("stroke-width", d => (d.usage > 0 ? 5 : 2.5))
        .attr("stroke-opacity", 0.8)
        .attr("stroke-linecap", "round")
        .classed("link-flow-active", d => d.usage > 0 && d.status !== "DOWN");

    // B. Label Persentase
    const linkText = svg.append("g")
        .attr("class", "link-labels")
        .selectAll("text")
        .data(data.links)
        .enter().append("text")
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .attr("fill", "#ef4444")
        .text(d => d.label || (d.usage > 0 ? d.usage + "%" : ""));
   
    // C. Nodes (Switch/Host)
    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(data.nodes)
        .enter().append("circle")
        .attr("r", d => (d.type === "switch" ? 22 : 16))
        .attr("fill", d => (d.type === "switch" ? "#38bdf8" : "#22c55e"))
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // D. Label Nama ID
    const label = svg.append("g")
        .attr("class", "node-labels")
        .selectAll("text")
        .data(data.nodes)
        .enter().append("text")
        .text(d => d.id)
        .attr("dx", 28)
        .attr("dy", 5);

    // E. Update Posisi (Tick)
    simulation.nodes(data.nodes).on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x).attr("y2", d => d.target.y);

        linkText.attr("x", d => (d.source.x + d.target.x) / 2)
                .attr("y", d => (d.source.y + d.target.y) / 2);

        node.attr("cx", d => d.x = Math.max(30, Math.min(width - 30, d.x)))
            .attr("cy", d => d.y = Math.max(30, Math.min(height - 30, d.y)));

        label.attr("x", d => d.x).attr("y", d => d.y);
    });

    simulation.force("link").links(data.links);
    simulation.alpha(1).restart();
}

// 4. Update Visual Data (Warna & Persen) Tanpa Reset Posisi
function updateTopologyVisuals() {
    if (!lastDataSnapshot) return;

    svg.select(".links").selectAll("line")
        .data(lastDataSnapshot.links)
        .attr("stroke", d => (d.status === "DOWN" ? "#ef4444" : (d.usage > 0 ? "#0a3d62" : "#94a3b8")))
        .attr("stroke-width", d => (d.usage > 0 ? 5 : 2.5))
        .classed("link-flow-active", d => d.usage > 0 && d.status !== "DOWN");

    svg.select(".link-labels").selectAll("text")
        .data(lastDataSnapshot.links)
        .text(d => d.label || (d.usage > 0 ? d.usage + "%" : ""));
}

// 5. Cek Perubahan Struktur
function isTopologyChanged(newData) {
    if (!lastDataSnapshot) return true;
    const oldIds = lastDataSnapshot.nodes.map(n => n.id).sort().join(",");
    const newIds = newData.nodes.map(n => n.id).sort().join(",");
    return oldIds !== newIds || lastDataSnapshot.links.length !== newData.links.length;
}

// 6. Parsing Data Ryu + Inject Host Statis
function formatRyuData(ryuJson) {
    let nodes = [];
    let links = [];
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

    if (ryuJson.links) {
        ryuJson.links.forEach(l => {
            const srcId = "s" + parseInt(l.src.dpid, 16);
            const dstId = "s" + parseInt(l.dst.dpid, 16);
            const srcInt = parseInt(l.src.dpid, 16);
            let usage = 0, label = "";

            // Logika Persentase S1 & S3
            if (srcId === "s1" && (dstId === "s2" || dstId === "s3")) {
                usage = 1;
                const s = groupMap[srcInt];
                if (s && s.byte_count > 0) {
                    label = (dstId === "s2") ? 
                        ((s.bucket_stats[0].byte_count/s.byte_count)*100).toFixed(2)+"%" : 
                        ((s.bucket_stats[1].byte_count/s.byte_count)*100).toFixed(2)+"%";
                } else { label = (dstId === "s2") ? "70%" : "30%"; }
            } else if (srcId === "s3" && (dstId === "s1" || dstId === "s4")) {
                usage = 1;
                const s = groupMap[srcInt];
                if (s && s.byte_count > 0) {
                    label = (dstId === "s1") ? 
                        ((s.bucket_stats[0].byte_count/s.byte_count)*100).toFixed(2)+"%" : 
                        ((s.bucket_stats[1].byte_count/s.byte_count)*100).toFixed(2)+"%";
                } else { label = (dstId === "s1") ? "50%" : "50%"; }
            }

            links.push({ source: srcId, target: dstId, usage, status: l.status || "UP", label });
        });
    }

    // Injeksi Host (Agar tidak hilang saat update)
    const staticHosts = [{id: "h1", sw: "s1"}, {id: "h4", sw: "s2"}, {id: "h3", sw: "s3"}, {id: "h2", sw: "s4"}];
    staticHosts.forEach(h => {
        if (nodes.find(n => n.id === h.sw)) {
            nodes.push({ id: h.id, type: "host" });
            links.push({ source: h.id, target: h.sw, usage: 0, status: "UP", label: "" });
        }
    });

    return { nodes, links };
}

// 7. Tabel Load Balancer
function updateLBTable(groupsData) {
    const tableBody = document.getElementById("lb-table-body");
    let active = null;
    if (groupsData) {
        groupsData.forEach(g => {
            const dpid = Object.keys(g)[0];
            if (parseInt(dpid, 16) === parseInt(selectedSwitchId)) active = g[dpid][0];
        });
    }
    if (!active) return;
    const b0 = active.bucket_stats[0], b1 = active.bucket_stats[1], total = active.byte_count;
    tableBody.innerHTML = `
        <tr><td>Packet Count</td><td>${b0.packet_count}</td><td>${b1.packet_count}</td><td>${active.packet_count}</td></tr>
        <tr><td>Byte Count</td><td>${(b0.byte_count/1e9).toFixed(2)} GB</td><td>${(b1.byte_count/1e9).toFixed(2)} GB</td><td>${(total/1e9).toFixed(2)} GB</td></tr>
        <tr><td>Persentase</td><td>${total>0?((b0.byte_count/total)*100).toFixed(2):0}%</td><td>${total>0?((b1.byte_count/total)*100).toFixed(2):0}%</td><td>100%</td></tr>`;
}

// 8. Event Switch Button
function changeActiveSwitch(swNum) {
    selectedSwitchId = swNum.toString();
    document.querySelectorAll('.sw-btn').forEach(btn => btn.classList.remove('active'));
    if (document.getElementById(`btn-s${swNum}`)) document.getElementById(`btn-s${swNum}`).classList.add('active');
}

// 9. Integrasi WebSocket (LOGIKA MERGE PERMANEN)
const socket = new WebSocket('ws://' + window.location.host + '/ws/topology/');

socket.onmessage = function(event) {
    const incoming = JSON.parse(event.data);
    if (incoming.type === 'topology_update') {
        if(incoming.data.groups) updateLBTable(incoming.data.groups);

        const newData = formatRyuData(incoming.data);

        // Jika struktur berubah (nambah/kurang node), gambar ulang semua
        if (isTopologyChanged(newData)) {
            lastDataSnapshot = newData;
            drawTopology(newData);
        } else {
            // Jika struktur sama, HANYA update nilai usage & label di objek yang sudah ada
            lastDataSnapshot.links.forEach(oldL => {
                const sId = (typeof oldL.source === "object") ? oldL.source.id : oldL.source;
                const tId = (typeof oldL.target === "object") ? oldL.target.id : oldL.target;
                
                const match = newData.links.find(nL => nL.source === sId && nL.target === tId);
                if (match) {
                    oldL.usage = match.usage;
                    oldL.status = match.status;
                    oldL.label = match.label;
                }
            });
            updateTopologyVisuals();
        }
    }
};

// 10. Drag Helpers
function dragstarted(event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }