// 1. Setup tempat gambarnya (SVG)
const svg = d3.select("svg"),
    width = window.innerWidth,
    height = 500;

// 2. Setup simulasi gaya (biar bulatan gak tumpuk-tumpukan)
const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(150))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2));

// 3. Ambil data dari API Django
fetch('/api/topology/')
    .then(response => response.json())
    .then(data => {
        // A. Gambar Garis (Links)
        const link = svg.append("g")
            .selectAll("line")
            .data(data.links)
            .enter().append("line")
            .attr("stroke", "#999")
            .attr("stroke-width", 2);

        // B. Gambar Bulatan (Nodes)
        const node = svg.append("g")
            .selectAll("circle")
            .data(data.nodes)
            .enter().append("circle")
            .attr("r", d => d.type === "switch" ? 18 : 12) // Switch lebih gede dikit
            .attr("fill", d => d.type === "switch" ? "#007bff" : "#28a745") // Biru=Switch, Hijau=Host
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .style("cursor", "pointer")
            .call(d3.drag() 
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        // C. FITUR KLIK (TASK 3) - Sekarang sudah di DALAM scope fetch
        node.on("click", (event, d) => {
            const action = d.status === "down" ? "up" : "down";
            const labelPesan = action === "up" ? "Nyalakan" : "Matikan";

            if(confirm(`${labelPesan} switch ${d.id}?`)) {
                fetch(`/api/node-control/${d.id}/${action}/`)
                    .then(res => res.json())
                    .then(result => {
                        if(result.status === "success") {
                            d.status = action; // Simpan status sementara
                            // Ganti warna: Merah kalau mati, Biru kalau nyala
                            d3.select(event.currentTarget)
                                .attr("fill", action === "down" ? "#dc3545" : "#007bff");
                            alert(`Notifikasi: ${d.id} berhasil di-${action}`);
                        }
                    });
            }
        });

        // D. Kasih label nama (s1, h1, dll)
        const label = svg.append("g")
            .selectAll("text")
            .data(data.nodes)
            .enter().append("text")
            .text(d => d.id)
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("dx", 22)
            .attr("dy", 5);

        // E. Update posisi setiap kali simulasi bergerak (Tick)
        simulation.nodes(data.nodes).on("tick", () => {
            link.attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node.attr("cx", d => d.x).attr("cy", d => d.y);
            label.attr("x", d => d.x).attr("y", d => d.y);
        });

        simulation.force("link").links(data.links);
    });

// Fungsi Drag (Biar bisa ditarik mouse)
function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
}
function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; d.fy = null;
}

function loadMetrics() {
    fetch("/api/metrics/")
    .then(res => res.json())
    .then(data => {
        document.getElementById("metrics").innerText =
            JSON.stringify(data, null, 2);
    });
}