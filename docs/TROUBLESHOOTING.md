# Panduan Troubleshooting & FAQ

Dokumen ini memuat solusi untuk masalah umum yang sering ditemui saat implementasi printer kasir di lingkungan produksi.

---

## 1. Masalah Izin Akses USB di Linux (`Permission Denied`)

### Gejala:
Error di terminal:
```
Error: EACCES: permission denied, open '/dev/usb/lp0'
```

### Penyebab:
Secara default, Linux membatasi akses ke perangkat `/dev/usb/lp*` hanya untuk user `root` atau grup `lp`.

### Solusi:
1. **Tambahkan user Anda ke grup `lp` dan `dialout`:**
   ```bash
   sudo usermod -aG lp,dialout $USER
   ```
   *(Setelah menjalankan perintah di atas, lakukan **Log out** lalu **Log in** kembali agar grup diterapkan)*.

2. **Beri izin baca/tulis sementara:**
   ```bash
   sudo chmod 666 /dev/usb/lp*
   ```

3. **Solusi Permanen via aturan `udev`:**
   Buat file aturan udev di `/etc/udev/rules.d/99-usb-printers.rules`:
   ```bash
   echo 'KERNEL=="lp*", SUBSYSTEM=="usbmisc", MODE="0666"' | sudo tee /etc/udev/rules.d/99-usb-printers.rules
   sudo udevadm control --reload-rules && sudo udevadm trigger
   ```

---

## 2. Port Sudah Digunakan (`EADDRINUSE`)

### Gejala:
```
Error: listen EADDRINUSE: address already in use :::8000
```

### Penyebab:
Ada proses Node.js lama atau web server lain yang sedang mendengarkan di port yang sama.

### Solusi:
1. Cari proses yang sedang memakai port:
   ```bash
   lsof -i :8000
   ```
2. Hentikan proses tersebut:
   ```bash
   kill -9 <PID>
   ```
   atau cepat dengan:
   ```bash
   fuser -k 8000/tcp
   ```

---

## 3. Odoo POS Menampilkan Ikon Merah ("Printer Disconnected")

### Pemeriksaan:
1. **Periksa Alamat IP & Port:**
   Pastikan di Odoo POS kolom **Proxy IP** diisi dengan alamat IP LAN komputer proxy dan port kasirnya, misal:
   ```
   192.168.1.50:8001
   ```
   *(Jangan masukkan `http://`, cukup `IP:PORT`)*.

2. **Periksa Firewall Komputer Proxy:**
   Pastikan port 8000 hingga 8010 dibuka pada firewall Linux:
   ```bash
   sudo ufw allow 8000:8010/tcp
   ```
   Atau di Windows Defender Firewall, tambahkan Inbound Rule untuk mengizinkan port TCP 8000–8010.

3. **Masalah HTTPS Odoo Production ("HTTPS connection to IoT Box failed"):**
   Jika server Odoo Anda diakses menggunakan **`https://`**, Odoo POS secara otomatis akan memaksa koneksi ke IoT Box / Print Proxy melalui protokol **`https://`** (misal `https://192.168.1.32:8001`).

   **Fitur Dual HTTP & HTTPS:**
   Print Proxy kini sudah dilengkapi dengan dukungan protokol ganda (HTTP & HTTPS) otomatis di semua port kasir.

   **Cara Mengatasinya (Hanya 1x per Browser Kasir):**
   1. Buka tab baru di browser kasir (Firefox / Chrome).
   2. Navigasikan ke URL proxy kasir Anda via HTTPS, contoh:
      ```
      https://192.168.1.32:8001
      ```
   3. Browser akan menampilkan peringatan keamanan sertifikat (*Self-Signed*):
      - **Di Firefox:** Klik tombol **Advanced...** $\rightarrow$ klik **Accept the Risk and Continue**.
      - **Di Chrome / Edge:** Klik **Advanced** $\rightarrow$ klik **Proceed to 192.168.1.32 (unsafe)**.
   4. Setelah tab terbuka dan menampilkan pesan status, kembali ke tab Odoo POS dan klik **Ok** / refresh POS.
   5. Indikator printer IoT Box akan langsung terhubung hijau!

---

## 4. Printer Windows Tidak Mau Mencetak via UNC (`\\localhost\...`)

### Gejala:
Error tidak dapat membuka koneksi printer di Windows.

### Solusi:
1. Buka **Control Panel** $\rightarrow$ **Devices and Printers**.
2. Klik kanan printer kasir Anda $\rightarrow$ pilih **Printer properties**.
3. Buka tab **Sharing** $\rightarrow$ Centang **Share this printer**.
4. Beri nama share sederhana tanpa spasi, contoh: `KASIR1`.
5. Buka tab **Security** $\rightarrow$ Pastikan grup `Everyone` memiliki hak akses **Print**.
6. Masukkan target di Print Proxy: `\\localhost\KASIR1`.

---

## 5. Cara Menjalankan sebagai Service Otomatis (Autostart)

Agar Print Proxy otomatis menyala saat komputer dinyalakan tanpa perlu membuka terminal manual:

### Opsi A: Menggunakan PM2 (Paling Direkomendasikan)
PM2 adalah process manager handal untuk Node.js.

1. Install PM2 secara global:
   ```bash
   sudo npm install -g pm2
   ```
2. Jalankan aplikasi dengan PM2:
   ```bash
   cd /home/technoindo/print-proxy
   pm2 start server.js --name "odoo-print-proxy"
   ```
3. Simpan agar auto-start saat booting komputer:
   ```bash
   pm2 startup
   pm2 save
   ```
4. Perintah berguna lainnya:
   - Cek status: `pm2 status`
   - Cek log cetak: `pm2 logs odoo-print-proxy`
   - Restart: `pm2 restart odoo-print-proxy`

### Opsi B: Menggunakan Systemd (Linux)
1. Buat file service:
   ```bash
   sudo nano /etc/systemd/system/print-proxy.service
   ```
2. Isi konfigurasi:
   ```ini
   [Unit]
   Description=Odoo Print Proxy Service
   After=network.target

   [Service]
   Type=simple
   User=technoindo
   WorkingDirectory=/home/technoindo/print-proxy
   ExecStart=/usr/bin/node /home/technoindo/print-proxy/server.js
   Restart=always
   RestartSec=5
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```
3. Aktifkan dan jalankan:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable print-proxy
   sudo systemctl start print-proxy
   ```

---

## 6. Printer Epson TM USB Hanya Muncul sebagai "USB Controller" (Tidak Ada di Auto-Detect)

### Gejala:
Di Windows Device Manager terdaftar `EPSON USB Controller for TM/BA/EU Printers` (`TMUSB64.SYS`), tetapi printer tidak muncul di menu *Printers & Scanners* dan tidak terdeteksi oleh tombol Auto-Detect proxy.

### Penyebab:
File yang diinstal adalah **TMUSB** (`TMUSB800e`), yang hanya merupakan driver controller USB fisik level rendah, **bukan driver pencetakan Windows Spooler**.

### Solusi:
Pasang antrean printer ke port fisik Epson USB (`ESDPRT001`):
1. **Opsi Driver Bawaan Windows (Cepat & Langsung Jalan):**
   Jalankan di PowerShell Administrator:
   ```powershell
   Add-PrinterDriver -Name "Generic / Text Only"
   Add-Printer -Name "EPSON TM-U220" -DriverName "Generic / Text Only" -PortName "ESDPRT001"
   ```
2. **Opsi Driver Resmi Epson:**
   Download dan install **Epson APD (Advanced Printer Driver)** resmi sesuai tipe printer yang digunakan (misal APD 4 untuk TM-U220 atau APD 5/6 untuk TM-T82/TM-T88) dari portal Epson POS.
3. Dokumentasi lengkap: Lihat [Panduan Solusi Kasus Printer Epson](file:///D:/technonindo-project/printer-proxy-main/docs/SOLUSI_KASUS_EPSON.md#kasus-1-printer-epson-tm-hanya-terbaca-sebagai-usb-controller-tidak-muncul-di-proxy).

---

## 7. Status Printer Windows "NotAvailable" Karena Mismatch Driver (Job Macet di Spooler)

### Gejala:
Driver printer muncul di Windows dengan status `NotAvailable`. Test print di proxy menghasilkan 200 OK tetapi kertas tidak keluar. Saat dicek via `Get-PrintJob`, antrean bertumpuk dengan status `Printing, Retained`.

### Penyebab:
Driver yang diinstal tidak cocok dengan hardware fisik (misal memasang driver `EPSON TM-T88VI Receipt` pada printer fisik `TM-U220`). Port monitor bidi Epson mendeteksi ID perangkat berbeda dan otomatis memblokir antrean pencetakan.

### Solusi:
1. Bersihkan antrean print spooler yang macet:
   ```powershell
   Get-PrintJob | Remove-PrintJob -ErrorAction SilentlyContinue
   ```
2. Hapus printer dengan driver yang salah:
   ```powershell
   Remove-Printer -Name "EPSON TM-T88VI Receipt" -ErrorAction SilentlyContinue
   ```
3. Pasangkan printer ke port fisik asli yang aktif (`ESDPRT001`) dengan driver yang tepat (atau `Generic / Text Only`).

---

## 8. Test Print ke Printer Dokumen Inkjet (Epson L-Series / Canon / HP) Tidak Merespons

### Gejala:
Printer Epson L220 / L3210 / printer inkjet dokumen biasa berhasil didaftarkan di proxy, tetapi saat diklik *Test Print*, printer fisik diam saja dan tidak menarik kertas.

### Penyebab:
Printer didaftarkan dengan mode kasir thermal (`mode: "printer"`, `type: "epson"`), sehingga proxy mengirimkan instruksi biner berekstensi kasir thermal (ESC/POS & pemotong kertas biner). Driver printer dokumen membuang paket data tersebut (*silent drop*) karena bukan format raster dokumen Windows.

### Solusi:
1. Di file [printers.json](file:///D:/technonindo-project/printer-proxy-main/printers.json), gunakan mode **`"standard"`** atau **`"gdi"`**:
   ```json
   "l220": {
     "mode": "standard",
     "target": "EPSON L220 Series",
     "port": 8003,
     "type": "matrix"
   }
   ```
2. Proxy kini sudah dilengkapi fitur **Smart Printer Detection**:
   - Deteksi otomatis pada modul `status.js` dan `auto-detect.js` akan mengarahkan target berjenis dokumen ke **Windows Text Engine (GDI / Out-Printer)** secara otomatis.
3. Dokumentasi lengkap: Lihat [Panduan Solusi Kasus Printer Epson](file:///D:/technonindo-project/printer-proxy-main/docs/SOLUSI_KASUS_EPSON.md#kasus-4-test-print-ke-epson-l220-series-diam--kertas-tidak-ditarik).
