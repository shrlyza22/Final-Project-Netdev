# 🚀 SDN Load Balancing Dashboard

Dashboard berbasis web untuk visualisasi topologi jaringan dan manajemen load balancing pada lingkungan Software-Defined Network (SDN).

> Dibangun menggunakan Ryu Controller, Mininet, Prometheus, dan Grafana — dikemas dalam antarmuka web untuk monitoring dan kontrol secara real-time.

---

## ✨ Fitur Utama

* 🔀 **Load Balancing Dinamis**

  * Mendukung skenario distribusi trafik:

    * 70/30 (asimetris)
    * 50/50 (simetris)
  * Diimplementasikan menggunakan OpenFlow Group Table (SELECT)

* 🌐 **Visualisasi Topologi**

  * Topologi diamond interaktif (4 switch, 4 host)
  * Monitoring status link secara real-time

* 📊 **Monitoring Real-Time**

  * Throughput
  * Latency
  * CPU Usage
  * Packet Loss
  * Memory Usage

* 🧠 **Kontrol Terpusat**

  * Mengelola perilaku jaringan melalui SDN controller (Ryu)
  * Integrasi REST API

* 🔐 **Sistem Safety Lock**

  * Mencegah pemutusan link saat trafik aktif (misalnya saat uji iperf)

---

## 🏗️ Gambaran Arsitektur

Proyek ini membagi sistem menjadi dua lapisan utama:

### 🔹 Control Plane & Monitoring

* Ryu Controller
* Prometheus (pengumpulan metrik)
* Grafana (visualisasi)
* Web App (Django)

### 🔹 Data Plane

* Mininet (emulasi jaringan)
* Open vSwitch (OVS)

📌 Sistem menggunakan **topologi diamond**, yang memungkinkan beberapa jalur routing untuk kebutuhan load balancing.

---

## 🧩 Teknologi yang Digunakan

| Layer            | Teknologi            |
| ---------------- | -------------------- |
| SDN Controller   | Ryu                  |
| Network Emulator | Mininet              |
| Virtual Switch   | Open vSwitch (OVS)   |
| Monitoring       | Prometheus + Grafana |
| Backend          | Django               |
| Containerization | Docker               |

---

## ⚙️ Cara Kerja Sistem

1. **Mininet** mensimulasikan topologi jaringan

2. **OVS switch** terhubung ke **Ryu Controller**

3. Ryu menginjeksi **flow rules & logika load balancing**

4. Exporter mengumpulkan metrik dari:

   * Data Plane (Mininet)
   * Control Plane (Ryu)

5. **Prometheus** menyimpan data time-series

6. **Grafana** memvisualisasikan metrik

7. Dashboard web mengintegrasikan semuanya dalam satu tampilan

---

## 🔀 Logika Load Balancing

### 🧠 Distribusi 70/30

* 70% trafik → jalur utama
* 30% trafik → jalur alternatif

### ⚖️ Distribusi 50/50

* Trafik dibagi rata ke dua jalur

📌 Menggunakan **flow-based hashing**, bukan pembagian per paket
👉 Artinya: distribusi akan terlihat akurat jika terdapat banyak flow/koneksi

---

## 🧪 Pengujian

### ✅ Uji Konektivitas

```bash
mininet> pingall
```

* Hasil yang diharapkan: `0% packet loss`

---

### 📡 Uji Trafik (iperf)

Digunakan untuk memvalidasi load balancing antara:

* H1 ↔ H2 (70/30)
* H3 ↔ H4 (50/50)

---

## 📊 Dashboard Monitoring

Dashboard menyediakan:

* Grafik trafik secara real-time (throughput, latency)
* Monitoring resource (CPU, memory)
* Visualisasi topologi interaktif

Seluruh data diambil dari Prometheus dan ditampilkan melalui Grafana.

---

## 🚧 Pengembangan Selanjutnya

* 🔄 Migrasi dari Mininet ke **Containernet**
* 💻 Penambahan **web terminal (xterm.js)**
* 🎯 Peningkatan akurasi load balancing (packet-level / P4)

---

## 🤝 Kontributor

* Reski Farras Adiefa
* Raihan Adnan Khawarizmi
* Sheren Aulia Azahra
* Muhammad Yusuf Ridwan H
* Raditya Vihandika Bari Jabran

---

## 📌 Catatan

Proyek ini dirancang sebagai **implementasi praktis SDN**, dengan fokus pada:

* Observabilitas real-time
* Traffic engineering
* Manajemen jaringan yang scalable

Bukan sekadar teori — sistem ini benar-benar berjalan. 💻⚡

---

## ⭐ Kalau proyek ini membantu...

Kasih star ⭐ ya — kecil buat kamu, berarti buat kami.

