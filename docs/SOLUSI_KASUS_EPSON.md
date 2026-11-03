# Panduan Solusi Kasus Printer Epson POS & Dokumen di Windows

Dokumen ini mendokumentasikan secara rinci analisis masalah, penyebab teknis, dan solusi langkah demi langkah untuk kasus konfigurasi printer **Epson TM-U220PD**, **Epson TM-T88VI / Seri TM Lainnya**, dan **Epson L220 Series (Inkjet)** yang telah diselesaikan pada sistem ini.

---

## 📌 Daftar Kasus yang Diselesaikan

1. [Kasus 1: Printer Epson TM Hanya Terbaca sebagai "USB Controller", Tidak Muncul di Proxy](#kasus-1-printer-epson-tm-hanya-terbaca-sebagai-usb-controller-tidak-muncul-di-proxy)
2. [Kasus 2: Status Printer Windows "NotAvailable" & Job Cetak Tertahan (Stuck di Spooler)](#kasus-2-status-printer-windows-notavailable--job-cetak-tertahan-stuck-di-spooler)
3. [Kasus 3: Karakteristik & Konfigurasi Khusus Epson TM-U220PD](#kasus-3-karakteristik--konfigurasi-khusus-epson-tm-u220pd)
4. [Kasus 4: Test Print ke Epson L220 Series Diam / Kertas Tidak Ditarik](#kasus-4-test-print-ke-epson-l220-series-diam--kertas-tidak-ditarik)

---

## Kasus 1: Printer Epson TM Hanya Terbaca sebagai "USB Controller", Tidak Muncul di Proxy

### Gejala:
* Printer fisik menyala dan kabel USB terhubung ke komputer Windows kasir.
* Di **Device Manager** $\rightarrow$ **Universal Serial Bus controllers**, muncul perangkat bernama **`EPSON USB Controller for TM/BA/EU Printers`** (`USB\VID_04B8&PID_0202`).
* Namun di menu Windows **Printers & Scanners** printer tidak muncul.
* Saat melakukan **Scan Printer USB / Lokal** di dashboard proxy (`http://localhost:8000`), printer Epson TM **tidak terdeteksi**.
* Log proxy mencatat error: `Printer 'POS-80' tidak ditemukan di Windows`.

### Penyebab Teknis:
Pengguna menginstal file installer bernama **`TMUSB800e`** (atau `TMUSBSetup.exe`). 
* **TMUSB** adalah singkatan dari *EPSON TM USB Device Driver*. File ini **hanya driver low-level USB bus/chipset controller**, bukan driver pencetakan Windows Spooler.
* Driver TMUSB hanya menginstal file driver `TMUSB64.SYS` ke System32 Windows, tetapi **TIDAK membuat antrean cetak di Windows Spooler (`Win32_Printer`)**.
* Karena modul [auto-detect.js](file:///D:/technonindo-project/printer-proxy-main/src/helpers/auto-detect.js) dan [windows-raw-print.ps1](file:///D:/technonindo-project/printer-proxy-main/scripts/windows-raw-print.ps1) proxy berkomunikasi melalui antrean Windows Spooler (`winspool.drv`), printer yang belum memiliki antrean Windows tidak akan dapat dibaca maupun dikirimi perintah cetak.

### Solusi:
1. Pahami perbedaan antara **TMUSB** dan **APD**:
   * **TMUSB**: Hanya bus controller USB (tidak bisa mencetak langsung via Spooler).
   * **APD (Advanced Printer Driver)**: Driver resmi lengkap yang membuat antrean printer Windows (misal: `EPSON TM-U220 Receipt` atau `EPSON TM-T82 Receipt`).
2. Gunakan salah satu metode berikut untuk membuat antrean printer di Windows:
   * **Metode A (Driver Resmi APD):** Download dan instal Epson APD sesuai tipe printer yang tepat dari portal resmi Epson ([download.epson-biz.com](https://download.epson-biz.com/)).
   * **Metode B (Driver Generic / Text Only Windows ke Port ESDPRT):** 
     Port USB fisik printer yang ditangani controller TMUSB biasanya dipetakan oleh *Epson Port Handler Monitor* ke port bernama **`ESDPRT001`**. Anda dapat memasangkan driver built-in Windows `Generic / Text Only` ke port `ESDPRT001` tersebut melalui PowerShell:
     ```powershell
     Add-PrinterDriver -Name "Generic / Text Only"
     Add-Printer -Name "EPSON TM-U220" -DriverName "Generic / Text Only" -PortName "ESDPRT001"
     ```

---

## Kasus 2: Status Printer Windows "NotAvailable" & Job Cetak Tertahan (Stuck di Spooler)

### Gejala:
* Driver Epson APD sudah diinstal (misal: `EPSON TM-T88VI Receipt`), tetapi status printer di Windows menunjukkan **`NotAvailable`** (Offline/Error).
* Saat melakukan Test Print, log proxy mencatat `Status: 200 OK`, namun kertas tidak keluar sama sekali.
* Saat diperiksa dengan PowerShell `Get-PrintJob`, seluruh job cetak menumpuk dengan status:
  ```text
  JobStatus : Printing, Retained
  Datatype  : RAW
  Size      : 237 byte
  ```

### Penyebab Teknis:
1. **Ketidakcocokan Model (Model Mismatch):**
   Printer fisik yang tercolok adalah seri **TM-U220**, tetapi driver yang diinstal adalah untuk **TM-T88VI**.
2. **Penolakan oleh Language Monitor Epson:**
   Driver Epson APD memiliki monitor bahasa bidi (`EA5LMTMT88VI.DLL` untuk T88VI). Ketika job dikirim, monitor port menanyakan identitas perangkat keras ke port USB. Ketika perangkat menjawab `USB TM-U220`, driver T88VI menolak berkomunikasi karena ID perangkat tidak cocok. Akibatnya port ditutup, printer ditandai `NotAvailable`, dan semua job cetak ditahan (*retained*) selamanya di Spooler.
3. **Salah Pemilihan Port:**
   Driver T88VI otomatis membuat port virtual baru `ESDPRT003` (yang kosong/tanpa hardware), sementara printer fisik TM-U220 sebenarnya berada di port `ESDPRT001`.

### Solusi:
1. Bersihkan seluruh job cetak yang tertahan di spooler:
   ```powershell
   Get-PrintJob -PrinterName 'EPSON TM-T88VI Receipt' -ErrorAction SilentlyContinue | Remove-PrintJob
   ```
2. Hapus printer dengan driver yang tidak cocok tersebut:
   ```powershell
   Remove-Printer -Name 'EPSON TM-T88VI Receipt' -ErrorAction SilentlyContinue
   ```
3. Pasangkan driver yang sesuai (atau `Generic / Text Only`) langsung ke port fisik yang aktif (**`ESDPRT001`**):
   ```powershell
   Add-Printer -Name "EPSON TM-U220" -DriverName "Generic / Text Only" -PortName "ESDPRT001"
   ```
4. Pastikan status printer berubah menjadi **`Normal`**:
   ```powershell
   Get-Printer "EPSON TM-U220" | Select-Object Name, PortName, PrinterStatus
   ```

---

## Kasus 3: Karakteristik & Konfigurasi Khusus Epson TM-U220PD

### Karakteristik Hardware:
* **Jenis Cetak:** **Dot Matrix (Impact Ribbon)** dengan 9 jarum cetak dan pita tinta **Epson ERC-38** (bukan kertas panas / thermal).
* **Varian Model "PD":**
  * Huruf **"D"**: Menggunakan *tear-bar* (sobek kertas manual, **tidak memiliki auto-cutter fisik**).
  * Huruf **"P"**: Seri dengan basis port Parallel yang telah dipasangi kartu interface internal USB Epson (**UB-U01 / UB-U02 / UB-U03**).

### Konfigurasi yang Tepat di Proxy:
1. Di file [printers.json](file:///D:/technonindo-project/printer-proxy-main/printers.json):
   ```json
   {
     "serverPort": 8000,
     "defaultPrinter": "kasir1",
     "charsPerLine": 33,
     "printers": {
       "kasir1": {
         "mode": "printer",
         "target": "EPSON TM-U220",
         "port": 8001,
         "type": "epson"
       }
     }
   }
   ```
2. **Keterangan Pengaturan:**
   * **`charsPerLine: 33`**: TM-U220 menggunakan lebar standar 33/35 karakter pada Font A (kertas 76mm). Pengaturan 33 karakter mencegah teks terpotong ke baris baru secara tidak teratur.
   * **Auto-Cutter**: Karena varian TM-U220D adalah *manual tear*, perintah potong kertas otomatis (`printer.cut()`) yang dikirim oleh Odoo POS akan diabaikan secara aman oleh firmware printer tanpa menimbulkan error.

---

## Kasus 4: Test Print ke Epson L220 Series Diam / Kertas Tidak Ditarik

### Gejala:
* Printer **EPSON L220 Series** didaftarkan di proxy kasir.
* Saat tombol **Test Print** diklik di dashboard, muncul notifikasi sukses dan log proxy mencatat status `200 OK`.
* Namun printer fisik Epson L220 diam saja, tidak menarik kertas, dan tidak ada aktivitas cetak.

### Penyebab Teknis:
1. **Perbedaan Bahasa Cetak (ESC/POS vs GDI / Raster):**
   * Epson L220 adalah printer dokumen **Inkjet A4**, bukan printer struk kasir thermal.
   * Ketika didaftarkan dengan mode standar kasir (`mode: "printer"`, `type: "epson"`), modul test print proxy mengirimkan **kode biner mentah ESC/POS thermal** (termasuk kode font kasir `\x1b\x40` dan perintah potong kertas `\x1d\x56`).
   * Driver `Epson ESC/P Standard 10 V4 Class Driver` pada Epson L220 tidak mengenali perintah kasir ESC/POS tersebut.
2. **Silent Drop oleh Driver Spooler:**
   Karena aliran data biner mentah dianggap bukan format raster GDI dokumen A4 yang valid, driver Windows Spooler Epson L220 **membuang data tersebut secara diam-diam (*silent drop*)** tanpa memicu error pada sistem.

### Solusi & Peningkatan Kode Proxy:
Kami telah memperbarui modul proxy agar memiliki **Smart Printer Detection**:

1. **Auto-Detect Cerdas ([src/helpers/auto-detect.js](file:///D:/technonindo-project/printer-proxy-main/src/helpers/auto-detect.js)):**
   Saat mendeteksi printer yang terpasang di Windows, jika nama driver atau nama printer mengandung kata kunci printer dokumen (`Series`, `Ink`, `Canon`, `Deskjet`, `Laserjet`, `L220`, `PDF`, dll.), proxy otomatis menyarankan **`mode: "standard"`** (bukan mode thermal).

2. **Smart Route Test Print ([src/routes/status.js](file:///D:/technonindo-project/printer-proxy-main/src/routes/status.js)):**
   Pada endpoint `/printers/test`, proxy memeriksa nama target printer. Jika target merupakan printer dokumen, proxy otomatis memformat struk menjadi teks monospace bersih dan mengirimkannya melalui **Windows Text Engine (GDI / Out-Printer)** tanpa kode biner cutter.

3. **Kompatibilitas Spooler ([scripts/windows-raw-print.ps1](file:///D:/technonindo-project/printer-proxy-main/scripts/windows-raw-print.ps1)):**
   Skrip Windows Spooler disempurnakan agar printer seri `L220` atau `Series` otomatis dialihkan ke fungsi `Print-ViaTextEngine` untuk mencetak teks dokumen dengan sempurna.

---

## 📋 Tabel Ringkasan Rekomendasi Setup

| Printer Fisik | Driver Windows | Port Windows | Mode Proxy | Fungsi di POS / Odoo |
| :--- | :--- | :--- | :--- | :--- |
| **Epson TM-U220PD** | `Generic / Text Only` atau `EPSON TM-U220 Receipt` | `ESDPRT001` | `"mode": "printer"`, `"type": "epson"` | Struk Kasir Utama (Port 8001) |
| **Epson TM-T82 / TM-T88** | `EPSON TM-T82 Receipt` / `EPSON TM-T88 Receipt` | `ESDPRT001` / USB | `"mode": "printer"`, `"type": "epson"` | Struk Kasir Thermal (Port 8001 / 8002) |
| **Epson L220 / Seri L Lainnya** | `Epson ESC/P Standard V4` | `USB001` | `"mode": "standard"`, `"type": "matrix"` | Cetak Faktur / Surat Jalan A4 via `/dotmatrix/print` |
