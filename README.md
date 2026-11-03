# Odoo Print Proxy & Hardware Bridge

> Jembatan perangkat keras (*hardware bridge*) dan emulator POSBox/IoT Box independen berbasis Node.js yang menghubungkan **Odoo Point of Sale (POS)** dan aplikasi kasir ke printer thermal (ESC/POS), dot matrix (ESC/P), LAN, dan Bluetooth.

---

## 🚀 Memulai Cepat

```bash
# 1. Install dependensi
npm install

# 2. Jalankan server
node server.js
```

Akses Web Dashboard di: **`http://localhost:8000`**

---

## 🪟 Panduan Penggunaan di Windows Kasir

Di lingkungan Windows kasir, gunakan skrip otomatis berikut:
- **`start-hidden.vbs`**: Jalankan server di latar belakang (*silent mode*, tanpa jendela CMD yang rentan ditutup kasir).
- **`start.bat`**: Jalankan server di jendela CMD interaktif (untuk pemantauan real-time).
- **`stop.bat`**: Hentikan proses print proxy yang berjalan di background.
- **`status.bat`**: Periksa status kesehatan server dan info printer terdaftar.
- **`install-startup.bat`**: Pasang auto-startup agar proxy otomatis menyala saat komputer kasir dihidupkan/reboot.
- **`setup-firewall.bat`**: Buka port multi-kasir 8000–8020 di Windows Defender Firewall secara otomatis.
- **`npm test`**: Jalankan automated test suite (pengujian print queue, logger, dan endpoint HTTP).

Log riwayat transaksi harian tersimpan otomatis di folder **`logs/print-proxy-YYYY-MM-DD.log`** (retensi 14 hari).

---

## 📚 Dokumentasi Lengkap

Dokumentasi lengkap dan mendalam tersedia di folder **[`docs/`](file:///home/technoindo/print-proxy/docs/)**:

1. [**Ringkasan & Arsitektur Sistem**](file:///home/technoindo/print-proxy/docs/README.md): Pengenalan, diagram alur, dan struktur folder.
2. [**Panduan Multi-Kasir & Odoo POS**](file:///home/technoindo/print-proxy/docs/MULTI_CASHIER_SETUP.md): Cara menghubungkan 1 komputer print-proxy ke banyak kasir (Kasir 1 port 8001, Kasir 2 port 8002, dst.).
3. [**Kompatibilitas Printer & Koneksi**](file:///home/technoindo/print-proxy/docs/PRINTER_COMPATIBILITY.md): Daftar merek printer (Epson, Xprinter, Panda, Iware, dll.), konfigurasi USB/LAN/Bluetooth, dan cara kerja Auto-Detect.
4. [**Referensi Lengkap API Endpoints**](file:///home/technoindo/print-proxy/docs/API_REFERENCE.md): Dokumentasi endpoint emulator POSBox Odoo (`/hw_proxy/*`), cetak XML QWeb, Raw Binary, Dot Matrix, dan CRUD printer.
5. [**Panduan Troubleshooting & FAQ**](file:///home/technoindo/print-proxy/docs/TROUBLESHOOTING.md): Solusi izin USB Linux (`dialout`/`lp`), port konflik, mixed content HTTPS, dan cara setting PM2 autostart.
