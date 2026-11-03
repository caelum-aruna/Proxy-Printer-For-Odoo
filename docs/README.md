# Dokumentasi Odoo Print Proxy & Hardware Bridge

**Odoo Print Proxy** adalah jembatan perangkat keras (*hardware bridge*) dan emulator POSBox/IoT Box independen berbasis Node.js yang menghubungkan **Odoo Point of Sale (POS)** dan aplikasi kasir lainnya ke berbagai jenis printer:
- **Thermal Printer ESC/POS** (Epson, Xprinter, Panda, Iware, Matrix Point, Rongta, dll.)
- **Dot Matrix ESC/P** (Epson LX-300, LX-310, LQ-310, dll.)
- **Printer Jaringan LAN / Ethernet** (Port 9100 RAW)
- **Printer Bluetooth RFCOMM**
- **Printer Sistem Operasi / Driver CUPS**

---

## 📚 Daftar Isi Dokumentasi

1. [Arsitektur & Ringkasan Sistem](file:///home/technoindo/print-proxy/docs/README.md#arsitektur-sistem)
2. [Panduan Instalasi & Menjalankan](file:///home/technoindo/print-proxy/docs/README.md#panduan-instalasi--menjalankan)
3. [Panduan Multi-Kasir & Odoo POS](file:///home/technoindo/print-proxy/docs/MULTI_CASHIER_SETUP.md)
   - Solusi 1 PC Proxy melayani banyak kasir & banyak printer sekaligus.
   - Cara konfigurasi di menu Odoo POS.
4. [Kompatibilitas Printer & Koneksi](file:///home/technoindo/print-proxy/docs/PRINTER_COMPATIBILITY.md)
   - Merek yang didukung (bukan hanya EPSON).
   - Konfigurasi USB (Linux `/dev/usb/lp*` vs Windows UNC Share), LAN, Bluetooth, CUPS.
   - Fitur Auto-Detect perangkat keras lokal & scan jaringan LAN.
5. [Referensi Lengkap API Endpoints](file:///home/technoindo/print-proxy/docs/API_REFERENCE.md)
   - Emulator POSBox Odoo (`/hw_proxy/*`).
   - Endpoint cetak struk XML QWeb & teks mentah (`/print/*`).
   - Endpoint Dot Matrix (`/dotmatrix/*`).
   - Manajemen dinamis printer & status (`/printers/*`).
6. [Panduan Troubleshooting & FAQ](file:///D:/technonindo-project/printer-proxy-main/docs/TROUBLESHOOTING.md)
   - Izin akses USB Linux (`dialout`/`lp`).
   - Konflik port dan tips produksi (PM2 & systemd).
   - Troubleshooting Windows Spooler & Mismatch Driver.
7. [Panduan Solusi Kasus Printer Epson POS & Dokumen](file:///D:/technonindo-project/printer-proxy-main/docs/SOLUSI_KASUS_EPSON.md)
   - Kasus Epson TMUSB vs APD (Advanced Printer Driver).
   - Solusi status `NotAvailable` & job macet di spooler.
   - Setup khusus Epson TM-U220PD (Dot Matrix Struk Kasir).
   - Solusi test print Epson L220 Series (Inkjet Dokumen A4).

---

## Arsitektur Sistem

```
+-------------------------------------------------------------+
|                      Odoo Point of Sale                     |
|            (Browser Kasir 1, Kasir 2, Kasir 3, ...)         |
+-------------------------------------------------------------+
         |                                  |
   (Port 8001: Kasir 1)              (Port 8002: Kasir 2)
         |                                  |
         v                                  v
+-------------------------------------------------------------+
|                Odoo Print Proxy (Node.js)                   |
|                                                             |
|  +--------------------+        +-------------------------+  |
|  | Web UI Dashboard   |        | Dynamic Config Manager  |  |
|  | (Port 8000)        |        | (printers.json)         |  |
|  +--------------------+        +-------------------------+  |
|                                                             |
|  +--------------------+        +-------------------------+  |
|  | POSBox Emulator    |        | Hardware Auto-Detector  |  |
|  | (/hw_proxy/*)      |        | (USB / CUPS / LAN 9100) |  |
|  +--------------------+        +-------------------------+  |
|                                                             |
|  +--------------------+        +-------------------------+  |
|  | XML QWeb Renderer  |        | Raw Binary Dot Matrix   |  |
|  | (ESC/POS Thermal)  |        | (ESC/P Direct Stream)   |  |
|  +--------------------+        +-------------------------+  |
+-------------------------------------------------------------+
         |                     |                     |
         v                     v                     v
+-----------------+   +-----------------+   +-----------------+
| Thermal Kasir 1 |   | Thermal Kasir 2 |   | Dot Matrix LX   |
| (/dev/usb/lp0)  |   | (/dev/usb/lp1)  |   | (Faktur A4/Kwit)|
+-----------------+   +-----------------+   +-----------------+
```

---

## Struktur Direktori Proyek

```
print-proxy/
├── config.js                   # Konfigurasi bawaan / fallback
├── printers.json               # Konfigurasi aktif & persisten (Dinamis)
├── server.js                   # Entry point aplikasi & multi-port listener
├── package.json                # Dependensi Node.js
├── public/                     # Web Dashboard UI interaktif
│   └── index.html              # Antarmuka web pengelola printer & kasir
├── src/
│   ├── app.js                  # Setup Express app, middleware & router
│   ├── helpers/
│   │   ├── auto-detect.js      # Detektor hardware USB, Serial, CUPS, LAN
│   │   ├── config-manager.js   # Pengelola konfigurasi CRUD & port socket
│   │   ├── format.js           # Utilitas format rupiah & perataan teks
│   │   ├── printer-builder.js  # Factory instance ThermalPrinter ESC/POS
│   │   ├── raw-printer.js      # Pengirim byte biner / Dot Matrix ESC/P
│   │   └── xml-renderer.js     # Parser tag XML receipt Odoo POS
│   └── routes/
│       ├── dotmatrix.js        # Route cetak faktur dot matrix
│       ├── posbox.js           # Route emulator POSBox Odoo (/hw_proxy/*)
│       ├── print.js            # Route cetak raw text
│       ├── receipt.js          # Route cetak struk XML/JSON (/print/receipt)
│       └── status.js           # Route CRUD printer, cek koneksi, scan
└── docs/                       # Dokumentasi lengkap
    ├── README.md
    ├── MULTI_CASHIER_SETUP.md
    ├── PRINTER_COMPATIBILITY.md
    ├── API_REFERENCE.md
    └── TROUBLESHOOTING.md
```

---

## Panduan Instalasi & Menjalankan

### 1. Kebutuhan Sistem
- **Node.js**: v14 atau lebih baru (disarankan v18 / v20 LTS).
- **Sistem Operasi**: Linux (Ubuntu, Debian, Raspberry Pi OS) atau Windows 10/11 / Windows Server.
- Jaringan LAN aktif (jika melayani banyak komputer kasir).

### 2. Instalasi Dependensi
Jalankan di direktori proyek:
```bash
npm install
```

### 3. Menjalankan Aplikasi
```bash
node server.js
```

Output di terminal akan menampilkan:
```
Print proxy dashboard jalan di http://localhost:8000
Printer terdaftar: kasir1, kasir2, kasirBluetooth, dapurLan, dotmatrix
Default Printer: kasir1
[Multi-Kasir] Port 8001 aktif dan siap menerima request Odoo.
[Multi-Kasir] Port 8002 aktif dan siap menerima request Odoo.
```

### 4. Mengakses Dashboard
Buka browser di:
```
http://localhost:8000
```
atau dari komputer kasir di jaringan LAN:
```
http://<IP_KOMPUTER_PROXY>:8000
```
