// 1. Setup tempat gambarnya (SVG)
const svg = d3.select("svg"),
    width = window.innerWidth,
    height = 500;

// 2. Setup simulasi gaya (biar bulatan gak tumpuk-tumpukan)
const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2));

// 3. Ambil data dari API Django yang kamu buat di views.py
fetch('/api/topology/')
    .then(response => response.json())
    .then(data => {
        // Gambar Garis (Links)
        const link = svg.append("g")
            .selectAll("line")
            .data(data.links)
            .enter().append("line")
            .attr("stroke", "#999")
            .attr("stroke-width", 2);

        // Gambar Bulatan (Nodes)
        const node = svg.append("g")
            .selectAll("circle")
            .data(data.nodes)
            .enter().append("circle")
            .attr("r", d => d.type === "switch" ? 15 : 10) // Switch lebih besar
            .attr("fill", d => d.type === "switch" ? "#007bff" : "#28a745") // Biru=Switch, Hijau=Host
            .call(d3.drag() // Biar bisa ditarik pake mouse
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        // Kasih label nama (s1, h1, dll)
        const label = svg.append("g")
            .selectAll("text")
            .data(data.nodes)
            .enter().append("text")
            .text(d => d.id)
            .attr("font-size", "12px")
            .attr("dx", 15)
            .attr("dy", 4);

        // Update posisi setiap kali simulasi bergerak
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

// Fungsi biar bisa di-drag
function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
}
function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; d.fy = null;
}

