// 1. Variabel Global & State Proteksi
let selectedSwitchId = "1";
const topoContainer = document.getElementById("topo-container");
const svg = d3.select("#topo-svg");

let width = topoContainer.clientWidth;
let height = 500;
let lastDataSnapshot = null;

// 🔥 VARIABEL BARU UNTUK SAFETY LOCK (ANTI-BOCOR) 🔥
window.protectedSwitches = [];
window.lastGroupBytes = {};
window.lockTimers = {}; // Nyimpen waktu terakhir trafik ngalir

// 2. Setup Simulasi 
const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(150))
    .force("charge", d3.forceManyBody().strength(-700))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .velocityDecay(0.6); 

// 3. Fungsi Menggambar 
function drawTopology(data) {
    if (!data || !data.nodes) return;
    svg.selectAll("*").remove();

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
        
        .attr("fill", d => {
            if (d.type === "host") return "#22c55e"; 
            return d.status === "DOWN" ? "#ef4444" : "#38bdf8"; 
        })
        .attr("stroke", "#fff").attr("stroke-width", 2)
        .style("cursor", d => d.type === "switch" ? "pointer" : "default") 
        
        // FITUR KLIK & PROTEKSI
        .on("click", function(event, d) {
            if (event.defaultPrevented) return; 

            if (d.type === "switch") {
                const isCurrentlyDown = d.status === "DOWN";
                const targetState = isCurrentlyDown ? "up" : "down";
                const actionText = isCurrentlyDown ? "MENGHIDUPKAN" : "MEMATIKAN";
                
                // 🔥 LOGIKA SAFETY LOCK 🔥
                if (targetState === "down" && window.protectedSwitches.includes(d.id)) {
                    alert(`🚨 AKSES DITOLAK!\n\nSwitch ${d.id.toUpperCase()} tidak bisa dimatikan karena sedang sibuk menjadi PENGIRIM atau PENERIMA data (Trafik Iperf sedang berjalan).\nTunggu hingga aliran data selesai!`);
                    return; 
                }

                const confirmAction = confirm(`Apakah Anda yakin ingin ${actionText} ${d.id.toUpperCase()} di Mininet?`);
                
                if (confirmAction) {
                    socket.send(JSON.stringify({
                        'type': 'toggle_switch',
                        'action': 'toggle_switch',
                        'dpid': d.id,          
                        'target_state': targetState 
                    }));
                }
            }
        })
        .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

    // D. Node Labels
    const label = svg.append("g").attr("class", "node-labels")
        .selectAll("text").data(data.nodes)
        .enter().append("text")
        .text(d => d.id).attr("dx", 28).attr("dy", 5);

    // E. TICK SIMULATION 
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

// 4. Update Visual Tanpa Geser Koordinat
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

    svg.selectAll(".nodes-layer circle")
        .data(lastDataSnapshot.nodes)
        .attr("fill", d => {
            if (d.type === "host") return "#22c55e"; 
            return d.status === "DOWN" ? "#ef4444" : "#38bdf8"; 
        });
}

// 6. Parsing Data Ryu
function formatRyuData(ryuJson) {
    if (!ryuJson.switches || ryuJson.switches.length === 0) {
        return { nodes: [], links: [] }; 
    }
    
    let nodes = [];
    let groupMap = {};
    const staticSwitches = ["s1", "s2", "s3", "s4"];
    
    let activeSwitches = [];
    if (ryuJson.switches) {
        activeSwitches = ryuJson.switches.map(sw => "s" + parseInt(sw.dpid, 16));
    }

    staticSwitches.forEach(sw_id => {
        if (activeSwitches.includes(sw_id)) {
            nodes.push({ id: sw_id, type: "switch", status: "UP" });
        } else {
            nodes.push({ id: sw_id, type: "switch", status: "DOWN" });
        }
    });    

    if (ryuJson.groups) {
        ryuJson.groups.forEach(g => {
            const dpid = Object.keys(g)[0];
            groupMap[parseInt(dpid, 16)] = g[dpid][0];
        });
    }

    let uniqueLinks = {
        "s1-s2": { source: "s1", target: "s2", usage: 0, status: "UP", label: "" },
        "s1-s3": { source: "s1", target: "s3", usage: 0, status: "UP", label: "" },
        "s2-s4": { source: "s2", target: "s4", usage: 0, status: "UP", label: "" },
        "s3-s4": { source: "s3", target: "s4", usage: 0, status: "UP", label: "" }
    };
    let links = Object.values(uniqueLinks);

    let activeSenderDpid = null;
    let maxByteCount = 0;
    let activeGroup = null;

    Object.keys(groupMap).forEach(dpid => {
        const g = groupMap[dpid];
        if (g && g.byte_count > maxByteCount) {
            maxByteCount = g.byte_count;
            activeSenderDpid = dpid;
            activeGroup = g;
        }
    });

    // 🔥 LOGIKA PROTEKSI IPERF TAHAP 2 (COOLDOWN TIMER) 🔥
    window.protectedSwitches = []; 

    if (activeSenderDpid && activeGroup && maxByteCount > 0) {
        
        let currentBytes = activeGroup.byte_count;
        let lastBytes = window.lastGroupBytes[activeSenderDpid] || 0;

        // Kalau byte bertambah, reset timer ke waktu sekarang!
        if (currentBytes > lastBytes) {
            window.lockTimers[activeSenderDpid] = Date.now();
        }
        window.lastGroupBytes[activeSenderDpid] = currentBytes;

        // Gembok aktif jika data terakhir ngalir kurang dari 5 detik yang lalu
        let isFlowingNow = window.lockTimers[activeSenderDpid] && (Date.now() - window.lockTimers[activeSenderDpid] < 5000);

        if (isFlowingNow) {
            if (activeSenderDpid == "1") window.protectedSwitches = ["s1", "s4"];
            else if (activeSenderDpid == "3") window.protectedSwitches = ["s3", "s2"];
            else if (activeSenderDpid == "4") window.protectedSwitches = ["s4", "s1"];
            else if (activeSenderDpid == "2") window.protectedSwitches = ["s2", "s3"];
        }

        let b0 = ((activeGroup.bucket_stats[0].byte_count / activeGroup.byte_count) * 100).toFixed(2) + "%";
        let b1 = ((activeGroup.bucket_stats[1].byte_count / activeGroup.byte_count) * 100).toFixed(2) + "%";

        const findLink = (swA, swB) => links.find(l => 
            (l.source === swA && l.target === swB) || (l.source === swB && l.target === swA)
        );

        if (activeSenderDpid == "1") {
            let l1_1 = findLink("s1", "s2"); let l1_2 = findLink("s2", "s4");
            if(l1_1) { l1_1.usage = 1; l1_1.label = b0; }
            if(l1_2) { l1_2.usage = 1; l1_2.label = b0; }

            let l2_1 = findLink("s1", "s3"); let l2_2 = findLink("s3", "s4");
            if(l2_1) { l2_1.usage = 1; l2_1.label = b1; }
            if(l2_2) { l2_2.usage = 1; l2_2.label = b1; }
        }
        else if (activeSenderDpid == "3") {
            let l1_1 = findLink("s3", "s1"); let l1_2 = findLink("s1", "s2");
            if(l1_1) { l1_1.usage = 1; l1_1.label = b0; }
            if(l1_2) { l1_2.usage = 1; l1_2.label = b0; }

            let l2_1 = findLink("s3", "s4"); let l2_2 = findLink("s4", "s2");
            if(l2_1) { l2_1.usage = 1; l2_1.label = b1; }
            if(l2_2) { l2_2.usage = 1; l2_2.label = b1; }
        }
        else if (activeSenderDpid == "4") {
            let l1_1 = findLink("s4", "s2"); let l1_2 = findLink("s2", "s1");
            if(l1_1) { l1_1.usage = 1; l1_1.label = b0; }
            if(l1_2) { l1_2.usage = 1; l1_2.label = b0; }

            let l2_1 = findLink("s4", "s3"); let l2_2 = findLink("s3", "s1");
            if(l2_1) { l2_1.usage = 1; l2_1.label = b1; }
            if(l2_2) { l2_2.usage = 1; l2_2.label = b1; }
        }
        else if (activeSenderDpid == "2") {
            let l1_1 = findLink("s2", "s1"); let l1_2 = findLink("s1", "s3");
            if(l1_1) { l1_1.usage = 1; l1_1.label = b0; }
            if(l1_2) { l1_2.usage = 1; l1_2.label = b0; }

            let l2_1 = findLink("s2", "s4"); let l2_2 = findLink("s4", "s3");
            if(l2_1) { l2_1.usage = 1; l2_1.label = b1; }
            if(l2_2) { l2_2.usage = 1; l2_2.label = b1; }
        }
    }

    const staticHosts = [
        {id: "h1", sw: "s1", port: 3}, 
        {id: "h4", sw: "s2", port: 3}, 
        {id: "h3", sw: "s3", port: 3}, 
        {id: "h2", sw: "s4", port: 3}
    ];

    staticHosts.forEach(h => {
        let isHostUp = true; 
        const targetSwitch = nodes.find(n => n.id === h.sw);

        if (!targetSwitch || targetSwitch.status === "DOWN") {
            isHostUp = false;
        } else {
            const dpid = h.sw.replace('s', ''); 
            if (ryuJson.portdescs) {
                const swPortDesc = ryuJson.portdescs.find(pd => Object.keys(pd)[0] == dpid);
                if (swPortDesc) {
                    const ports = swPortDesc[dpid];
                    const hostPort = ports.find(p => p.port_no == h.port);
                    if (hostPort) {
                        if (hostPort.state === 1 || hostPort.config === 1) {
                            isHostUp = false; 
                        }
                    }
                }
            }
        }

        if (isHostUp) {
            nodes.push({ id: h.id, type: "host" });
            links.push({ source: h.id, target: h.sw, usage: 0, status: "UP", label: "" });
        }
    });

    links.forEach(l => {
        let srcStr = typeof l.source === 'object' ? l.source.id : l.source;
        let dstStr = typeof l.target === 'object' ? l.target.id : l.target;

        let srcNode = nodes.find(n => n.id === srcStr);
        let dstNode = nodes.find(n => n.id === dstStr);

        if ((srcNode && srcNode.status === "DOWN") || (dstNode && dstNode.status === "DOWN")) {
            l.usage = 0;
            l.label = "";
            l.status = "UP"; 
        }
    });

    return { nodes, links };
}

// 9. WebSocket
const socket = new WebSocket('ws://' + window.location.host + '/ws/topology/');
socket.onmessage = function(event) {
    const incoming = JSON.parse(event.data);
    if (incoming.type === 'topology_update') {
        const newData = formatRyuData(incoming.data);
        
        const errorOverlay = document.getElementById("error-overlay");
        const svgElement = document.getElementById("topo-svg");

        if (!newData.nodes || newData.nodes.length === 0) {
            svgElement.style.opacity = "0.1";
            errorOverlay.style.display = "block";
            document.getElementById("error-text").innerText = "Data Kosong atau Ryu Controller Mati";
            return; 
        } else {
            errorOverlay.style.display = "none";
            svgElement.style.opacity = "1";
        }

        if (!lastDataSnapshot || 
            lastDataSnapshot.nodes.length !== newData.nodes.length || 
            lastDataSnapshot.links.length !== newData.links.length) { 

            if (lastDataSnapshot) {
                newData.nodes.forEach(newNode => {
                    const oldNode = lastDataSnapshot.nodes.find(n => n.id === newNode.id);
                    if (oldNode) {
                        newNode.x = oldNode.x;
                        newNode.y = oldNode.y;
                        newNode.fx = oldNode.fx;
                        newNode.fy = oldNode.fy;
                    }
                });
            }

            lastDataSnapshot = newData;
            drawTopology(newData);
        } else {
            newData.nodes.forEach(newNode => {
                const oldNode = lastDataSnapshot.nodes.find(on => on.id === newNode.id);
                if(oldNode) { oldNode.status = newNode.status; }
            });

            newData.links.forEach(newLink => {
                const oldLink = lastDataSnapshot.links.find(ol => 
                    (typeof ol.source === 'object' ? ol.source.id : ol.source) === newLink.source &&
                    (typeof ol.target === 'object' ? ol.target.id : ol.target) === newLink.target
                );
                
                if (oldLink) {
                    oldLink.usage = newLink.usage;
                    oldLink.status = newLink.status;
                    oldLink.label = newLink.label;
                }
            });

            updateTopologyVisuals();
        }
        
        // --- UPDATE REAL-TIME SUMMARY DISINI ---
        updateSummary(newData.nodes);
        
        if(incoming.data.groups) updateLBTable(incoming.data.groups);
    }
};

// 10. Drag & Table Helpers 
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
function updateSummary(nodes) {
    // 1. Hitung Switch yang UP
    const activeSwitches = nodes.filter(n => n.type === 'switch' && n.status === 'UP').length;
    
    // 2. Hitung Host (Host yang ditarik formatRyuData otomatis hanya yang UP)
    const activeHosts = nodes.filter(n => n.type === 'host').length;
    
    // 3. Update DOM HTML
    const swElem = document.getElementById('total-switches');
    const hostElem = document.getElementById('total-hosts');
    const ctrlElem = document.getElementById('controller-status');

    if (swElem) swElem.innerText = `${activeSwitches} Nodes`;
    if (hostElem) hostElem.innerText = `${activeHosts} Nodes`;
    
    // 4. Update Status Controller (Jika ada switch UP, asumsikan controller active)
    if (ctrlElem) {
        if (activeSwitches > 0) {
            ctrlElem.innerText = "1 Active";
            ctrlElem.parentElement.classList.replace('text-danger', 'text-success');
        } else {
            ctrlElem.innerText = "0 Active";
            ctrlElem.parentElement.classList.replace('text-success', 'text-danger');
        }
    }
}