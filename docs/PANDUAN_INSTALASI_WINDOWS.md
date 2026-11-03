# 🪟 Panduan Lengkap Instalasi & Setup di Windows

Dokumen ini memuat panduan instalasi, konfigurasi printer, integrasi firewall, sertifikat SSL, dan auto-startup **Odoo Print Proxy & Hardware Bridge** di lingkungan sistem operasi **Windows 10 / Windows 11** secara lengkap dan terurut dari awal hingga siap digunakan pada transaksi kasir.

---

## 📋 Daftar Isi

1. [Prasyarat Sistem](#1-prasyarat-sistem)
2. [Langkah 1: Download & Persiapan Source Code](#langkah-1-download--persiapan-source-code)
3. [Langkah 2: Instalasi Dependensi Node.js](#langkah-2-instalasi-dependensi-nodejs)
4. [Langkah 3: Persiapan Driver & Antrean Printer di Windows](#langkah-3-persiapan-driver--antrean-printer-di-windows)
   - [A. Printer Kasir Thermal Standar (ESC/POS: Xprinter, Panda, dll.)](#a-printer-kasir-thermal-standar-escpos-xprinter-panda-iware-pos-80)
   - [B. Printer Epson Kasir Seri TM (TM-U220, TM-T82, TM-T88)](#b-printer-epson-kasir-seri-tm-tm-u220-tm-t82-tm-t88)
   - [C. Printer Dokumen Inkjet / Laser (Epson L-Series, Canon, HP)](#c-printer-dokumen-inkjet--laser-epson-l-series-canon-hp)
5. [Langkah 4: Buka Port Firewall (Akses Multi-Kasir)](#langkah-4-buka-port-firewall-akses-multi-kasir)
6. [Langkah 5: Pasang Sertifikat SSL / HTTPS (Wajib untuk Odoo Cloud / Web HTTPS)](#langkah-5-pasang-sertifikat-ssl--https-wajib-untuk-odoo-cloud--web-https)
7. [Langkah 6: Menjalankan Server Proxy](#langkah-6-menjalankan-server-proxy)
8. [Langkah 7: Konfigurasi Printer via Dashboard Web](#langkah-7-konfigurasi-printer-via-dashboard-web)
9. [Langkah 8: Hubungkan ke Odoo Point of Sale (POS)](#langkah-8-hubungkan-ke-odoo-point-of-sale-pos)
10. [Langkah 9: Pasang Auto-Startup (Menyala Otomatis Saat Booting)](#langkah-9-pasang-auto-startup-menyala-otomatis-saat-booting)
11. [Manajemen & Operasional Harian](#manajemen--operasional-harian)

---

## 1. Prasyarat Sistem

Sebelum memulai, pastikan komputer kasir memenuhi kriteria berikut:
* **Sistem Operasi:** Windows 10 atau Windows 11 (32-bit atau 64-bit).
* **Node.js:** Versi LTS (disarankan v18.x atau v20.x ke atas).
  * *Unduh Node.js resmi di:* [nodejs.org](https://nodejs.org/)
  * *Verifikasi di CMD:* `node -v` dan `npm -v`
* **Git for Windows:** (Opsional, untuk clone repo): [git-scm.com](https://git-scm.com/)
* **Hak Akses:** Hak Administrator lokal (untuk membuka port firewall dan memasang sertifikat root SSL).

---

## Langkah 1: Download & Persiapan Source Code

1. Siapkan folder proyek di komputer kasir, misalnya di `D:\technonindo-project\printer-proxy-main` atau `C:\pos\printer-proxy`.
2. Jika menggunakan Git:
   ```bash
   cd D:\technonindo-project
   git clone https://github.com/caelum-aruna/Proxy-Printer-For-Odoo.git printer-proxy-main
   cd printer-proxy-main
   ```
   *Atau jika mengunduh file ZIP, ekstrak isi file ZIP ke folder tersebut.*

---

## Langkah 2: Instalasi Dependensi Node.js

Buka **Command Prompt (CMD)** atau **PowerShell**, arahkan ke direktori proyek, lalu jalankan:

```bash
npm install --omit=dev
```

> [!TIP]
> Jika Anda ingin menjalankan pengujian otomatis (*automated test suite*), jalankan:
> ```bash
> npm install
> node test/run-all.js
> ```
> Pastikan seluruh pengujian bertanda **LULUS SUKSES**.

---

## Langkah 3: Persiapan Driver & Antrean Printer di Windows

Odoo Print Proxy di Windows mengirimkan data cetak melalui antrean **Windows Print Spooler (`winspool.drv`)**. Oleh karena itu, printer fisik wajib memiliki nama antrean yang terdaftar di Windows (**Settings $\rightarrow$ Bluetooth & devices $\rightarrow$ Printers & scanners**).

Sesuaikan dengan jenis printer yang Anda gunakan:

### A. Printer Kasir Thermal Standar (ESC/POS: Xprinter, Panda, Iware, POS-80)
1. Colokkan kabel USB printer ke PC kasir dan nyalakan printer.
2. Jalankan installer driver bawaan printer (atau driver universal POS-58 / POS-80).
3. Pastikan printer muncul di Windows dengan nama yang jelas, contoh: **`POS-80`** atau **`XP-80C`**.

---

### B. Printer Epson Kasir Seri TM (TM-U220, TM-T82, TM-T88)

> [!CAUTION]
> **Peringatan Penting Epson TM:**
> Jangan hanya menginstal driver `TMUSB` (seperti folder `TMUSB800e`). File tersebut hanya USB chipset driver dan **tidak membuat antrean cetak di Windows Spooler**.

Pilih salah satu dari 2 cara berikut:

#### Opsi 1: Menggunakan Driver Resmi Epson APD (Paling Direkomendasikan)
1. Download installer **Epson Advanced Printer Driver (APD)** sesuai tipe printer Anda:
   * **TM-U220:** Gunakan **Epson APD 4** (misal `APD_456eWM_U220.exe`).
   * **TM-T82 / TM-T82X:** Gunakan **Epson APD 5** atau **APD 6**.
   * **TM-T88VI:** Gunakan installer `APD_513R1_T88VI.exe`.
2. Jalankan installer $\rightarrow$ Pilih **Standard Installation** $\rightarrow$ Pilih port: **USB** (*Create a USB port*).
3. Setelah selesai, di Windows akan muncul antrean resmi, misalnya: **`EPSON TM-U220 Receipt`** atau **`EPSON TM-T82 Receipt`**.

#### Opsi 2: Cepat via Driver Windows "Generic / Text Only" (Tanpa Download APD)
Jika modul hardware USB sudah terbaca oleh Windows sebagai `EPSON USB Controller` (Port `ESDPRT001`), buka **PowerShell (Run as Administrator)** dan jalankan:
```powershell
Add-PrinterDriver -Name "Generic / Text Only"
Add-Printer -Name "EPSON TM-U220" -DriverName "Generic / Text Only" -PortName "ESDPRT001"
```
Verifikasi status printer:
```powershell
Get-Printer "EPSON TM-U220" | Select-Object Name, PortName, PrinterStatus
```
*(Pastikan statusnya **Normal**)*.

---

### C. Printer Dokumen Inkjet / Laser (Epson L-Series, Canon, HP)
* Jika menggunakan printer inkjet seperti **Epson L220 Series**, **L3210**, **Canon G1010**, atau **HP Deskjet/Laserjet**:
* Cukup install driver resmi dokumen bawaan Windows seperti biasa.
* Printer ini dapat digunakan untuk mencetak Surat Jalan, Laporan, atau Invoice A4 melalui proxy dengan mode **`standard`** atau **`gdi`**.

---

## Langkah 4: Buka Port Firewall (Akses Multi-Kasir)

Agar komputer kasir lain, laptop, atau tablet di jaringan lokal (LAN/Wi-Fi) dapat mengirim dokumen cetak ke komputer proxy ini, port 8000–8020 harus diizinkan di Windows Firewall.

1. Buka File Explorer ke folder proyek.
2. Cari file: **`setup-firewall.bat`**.
3. Klik kanan file tersebut $\rightarrow$ pilih **Run as administrator**.
4. Tunggu beberapa detik hingga muncul pesan:
   ```text
   [SUKSES] Port 8000 s/d 8020 berhasil dibuka di Windows Firewall!
   ```

---

## Langkah 5: Pasang Sertifikat SSL / HTTPS (Wajib untuk Odoo Cloud / Web HTTPS)

Jika sistem Odoo Anda diakses menggunakan alamat web yang aman (**`https://`**), browser akan memblokir komunikasi ke printer jika proxy menggunakan HTTP biasa (*Mixed Content Error*). Print Proxy sudah dilengkapi sertifikat SSL bawaan.

1. Buka File Explorer ke folder proyek.
2. Cari file: **`install-cert.bat`**.
3. Klik kanan file tersebut $\rightarrow$ pilih **Run as administrator**.
4. Skrip akan otomatis mengimpor sertifikat `certs/server.crt` ke penyimpanan **Trusted Root Certification Authorities** Windows.
5. Muncul notifikasi:
   ```text
   [SUKSES] Sertifikat SSL berhasil dipasang ke Windows!
   ```

---

## Langkah 6: Menjalankan Server Proxy

Anda memiliki 2 pilihan untuk menjalankan proxy:

### Opsi A: Mode Interaktif CMD (Untuk Uji Coba & Monitoring)
* Double-click file: **`start.bat`**.
* Jendela CMD akan terbuka dan menampilkan log aktivitas real-time.
* Jangan tutup jendela CMD ini selama kasir beroperasi.

### Opsi B: Mode Silent Background (Rekomendasi Operasional Toko)
* Double-click file: **`start-hidden.vbs`**.
* Server proxy akan langsung berjalan di latar belakang secara hening (*silent mode*).
* Kasir tidak akan sengaja menutup jendela CMD.

---

## Langkah 7: Konfigurasi Printer via Dashboard Web

1. Buka browser (Chrome / Edge / Firefox) di komputer kasir.
2. Buka alamat: **`http://localhost:8000`**.
3. Scroll ke bagian **Auto-Detect Printer** $\rightarrow$ klik tombol **`🔍 Scan Printer USB / Lokal`**.
4. Sistem akan otomatis mendeteksi semua printer yang terpasang di Windows.
5. Klik tombol **`+ Gunakan`** pada printer yang diinginkan:
   * **Kasir 1 (Port 8001):** Masukkan nama printer struk kasir Anda (contoh: `EPSON TM-U220` atau `POS-80`).
   * **Untuk Dot Matrix / Dokumen:** Bisa diatur pada printer profil lainnya.
6. Klik tombol **Test Print** di dashboard untuk menguji kertas keluar dari printer.

---

## Langkah 8: Hubungkan ke Odoo Point of Sale (POS)

1. Buka sistem Odoo POS Anda melalui browser.
2. Masuk ke **Point of Sale** $\rightarrow$ **Configuration** $\rightarrow$ **Settings** (atau buka konfigurasi kasir tertentu).
3. Pada bagian **Connected Devices / Hardware Proxy**:
   * Centang opsi **IoT Box / POSBox** (atau *Barcodes/Receipt Printer*).
   * Pada kolom **Proxy IP**, masukkan alamat IP lokal komputer proxy dan nomor port kasir:
     ```text
     192.168.1.11:8001
     ```
     *(Ganti `192.168.1.11` dengan alamat IP LAN komputer proxy Anda, dan `8001` sesuai port kasir. Jangan gunakan awalan `http://`)*.
4. Buka sesi POS Odoo:
   * Ikon printer IoT Box di pojok kanan atas layar POS akan langsung berubah menjadi **hijau (Terhubung)**.
   * Lakukan transaksi penjualan $\rightarrow$ Struk akan otomatis tercetak dari printer kasir!

---

## Langkah 9: Pasang Auto-Startup (Menyala Otomatis Saat Booting)

Agar petugas kasir tidak perlu menyalakan proxy secara manual setiap pagi:

1. Di folder proyek, double-click file: **`install-startup.bat`**.
2. Skrip akan mendaftarkan shortcut `start-hidden.vbs` ke folder Startup Windows:
   ```text
   %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
   ```
3. Mulai sekarang, setiap kali komputer kasir dinyalakan atau direstart, Odoo Print Proxy akan langsung aktif di latar belakang dan siap melayani transaksi.

---

## 🛠️ Manajemen & Operasional Harian

Proyek ini telah dilengkapi berbagai skrip utilitas untuk mempermudah operasional:

| File Skrip | Fungsi |
| :--- | :--- |
| **`status.bat`** | Double-click untuk memeriksa apakah server proxy sedang *ONLINE* atau *OFFLINE* beserta info printer default. |
| **`stop.bat`** | Double-click untuk mematikan proses background print proxy secara bersih. |
| **`start.bat`** | Menjalankan proxy di jendela konsol interaktif. |
| **`start-hidden.vbs`** | Menjalankan proxy di background tanpa tampilan CMD. |
| **`uninstall-startup.bat`** | Mencopot proxy dari daftar auto-startup Windows jika tidak dibutuhkan lagi. |
| **`logs/`** | Folder penyimpan riwayat cetak harian (`print-proxy-YYYY-MM-DD.log`) untuk audit dan pengecekan kendala. |
