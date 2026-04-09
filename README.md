# Pengembangan Dashboard Website Monitoring Jaringan Berbasis SDN untuk Visualisasi Topologi dan Load Balancing

## Tujuan dan Sasaran Penelitian

Kajian ini bertujuan untuk:

* Memahami arsitektur Software-Defined Networking (SDN) dalam memisahkan control plane dan data plane.
* Mengimplementasikan mekanisme load balancing berbasis Ryu Controller dengan skenario distribusi trafik 70/30 dan 50/50.
* Mengembangkan sistem monitoring jaringan berbasis web menggunakan Prometheus dan Grafana.
* Menganalisis performa jaringan berdasarkan metrik seperti throughput, latency, dan packet loss, CPU usage, dan Memory usage.
* Merancang sistem manajemen jaringan yang terpusat, adaptif, dan scalable.

---

## Gambaran Kajian

Kajian ini mengembangkan sistem jaringan berbasis SDN yang terdiri dari:

* Ryu Controller sebagai control plane
* Mininet sebagai emulator jaringan
* Open vSwitch (OVS) sebagai data plane
* Prometheus dan Grafana untuk monitoring
* Django sebagai web dashboard

Sistem ini dirancang untuk mengatasi bottleneck jaringan melalui load balancing serta meningkatkan visibilitas jaringan menggunakan dashboard berbasis web. 

---

## Spesifikasi Jaringan

Topologi yang digunakan adalah topologi diamond yang terdiri dari:

| Komponen | Jumlah    |
| -------- | --------- |
| Switch   | 4 (S1–S4) |
| Host     | 4 (H1–H4) |

Karakteristik:

* Setiap host terhubung ke satu switch
* Terdapat jalur redundan antar switch
* Mendukung multi-path routing untuk load balancing 

---

## Skenario Load Balancing

### Distribusi 70/30

* Digunakan untuk trafik H1 ke H2 dan berlaku sebaliknya
* 70% melalui jalur pertama
* 30% melalui jalur kedua

### Distribusi 50/50

* Digunakan untuk trafik H3 ke H4 dan berlaku sebaliknya
* Trafik dibagi secara merata

Pendekatan yang digunakan:

* OpenFlow Group Table tipe SELECT
* Flow-based hashing

---

## Lingkungan Pengujian

Sistem dijalankan pada dua lingkungan virtual:

### VM1 (Control Plane dan Monitoring)

* Ryu Controller
* Prometheus
* Grafana
* Web Dashboard (Django)

### VM2 (Data Plane)

* Mininet
* Open vSwitch

Komunikasi antar komponen menggunakan protokol OpenFlow. 

---

## Komponen dan Teknologi

* Ryu Controller
* Mininet
* Open vSwitch (OVS)
* Prometheus
* Grafana
* Docker
* Django

---

## Implementasi Sistem

Tahapan implementasi:

1. Membangun topologi jaringan pada Mininet
2. Menghubungkan switch OVS ke Ryu Controller
3. Mengimplementasikan logika load balancing pada controller
4. Mengumpulkan metrik menggunakan Prometheus
5. Menampilkan data melalui Grafana
6. Mengintegrasikan seluruh komponen ke dalam web dashboard

---

## Monitoring dan Evaluasi

Dashboard menyediakan:

* Visualisasi topologi jaringan
* Monitoring performa:

  a. Throughput
  b. Latency
  c. CPU Usage
  d. Packet Loss
  e. Memory Usage
* Kontrol jaringan secara real-time

Hasil pengujian menunjukkan:

* Konektivitas antar host berhasil (0% packet loss)
* Load balancing berjalan sesuai probabilitas konfigurasi
* Sistem monitoring mampu menampilkan data secara real-time 

---

## Pengembangan Selanjutnya

* Migrasi dari Mininet ke Containernet untuk meningkatkan isolasi sistem dan mendukung simulasi berbasis container yang lebih realistis.
* Integrasi web-terminal (seperti xterm.js atau Apache Guacamole) ke dalam dashboard untuk memudahkan konfigurasi dan kontrol langsung tanpa SSH terpisah.
* Peningkatan akurasi load balancing dengan pendekatan packet-level menggunakan teknologi programmable data plane (misalnya P4) atau OpenFlow QoS (meters).

---

## Referensi

Mengacu pada berbagai penelitian terkait:

* Software-Defined Networking
* Evaluasi performa controller SDN
* Sistem monitoring berbasis web

Detail lengkap tersedia pada bagian Daftar Pustaka di dokumen penelitian.
