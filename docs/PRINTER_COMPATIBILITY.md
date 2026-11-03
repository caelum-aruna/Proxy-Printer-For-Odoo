# Kompatibilitas Printer & Metode Koneksi

Dokumen ini menguraikan daftar merek printer yang didukung, jenis protokol, metode koneksi di Linux dan Windows, serta cara kerja fitur **Auto-Detect**.

---

## 🖨️ Apakah Hanya Mendukung Merek EPSON?

**Jawabannya: TIDAK.** 
Kata `epson` pada konfigurasi merujuk pada **Protokol Standar Industri ESC/POS** yang diciptakan oleh Epson dan sekarang menjadi standar de facto untuk 95%+ printer kasir termal di seluruh dunia.

Hampir semua printer kasir termal merek lokal maupun internasional menggunakan perintah ESC/POS, antara lain:

| Merek / Pabrikan | Tipe Printer | Protokol | Catatan |
| :--- | :--- | :--- | :--- |
| **Epson** | TM-T82, TM-T88, TM-U220 | ESC/POS | Standar referensi |
| **Xprinter** | XP-58, XP-80C, XP-Q90EC, dll. | ESC/POS | Sangat kompatibel |
| **Panda / Iware** | C-58, MP-80, IW-58, dll. | ESC/POS | Sangat kompatibel |
| **Matrix Point** | TMP-58, TMP-80 | ESC/POS | Sangat kompatibel |
| **Rongta / Sunmi** | RP80, RP326, T2 | ESC/POS | Sangat kompatibel |
| **Star Micronics** | TSP100, TSP650 | STAR / ESC/POS | Pilih tipe `star` jika menggunakan mode native Star |
| **Brother** | QL Series, TD Series | BROTHER | Menggunakan command set Brother |
| **Dot Matrix** | Epson LX-300, LX-310, LQ-310 | ESC/P | Menggunakan endpoint `/dotmatrix` atau `/print/raw` |

---

## 🔌 Jenis Koneksi & Penulisan Target

### 1. USB Langsung & Antrian Driver Windows (Direct Spooler)
Koneksi paling umum dan paling stabil untuk komputer kasir.

- **Linux / Raspberry Pi**:
  - Target: `/dev/usb/lp0`, `/dev/usb/lp1`, `/dev/usb/lp2`
  - Contoh: `"mode": "usb", "target": "/dev/usb/lp0"`
- **Windows (Native Windows Spooler)**:
  - **TIDAK PERLU SHARE PRINTER**: Menggunakan Win32 Spooler API native (`winspool.drv`).
  - Cukup masukkan nama printer persis seperti yang muncul di Windows (*Settings* $\rightarrow$ *Printers & Scanners* atau hasil Auto-Detect).
  - Mode: `"printer"` atau `"usb"`
  - Contoh: `"target": "EPSON LQ-310 ESC/P2"` atau `"target": "EPSON TM-T82"`
  - Bekerja untuk Dot Matrix (ESC/P) maupun Thermal POS (ESC/POS).

### 2. Jaringan LAN / Ethernet / Wi-Fi
Untuk printer dapur (*kitchen printer*) atau printer kasir yang terhubung ke switch/router.

- **Format Target**: Objek dengan `address` dan `port`:
  ```json
  "mode": "lan",
  "target": {
    "address": "192.168.1.100",
    "port": 9100
  }
  ```
- Port `9100` adalah port RAW printing standar (JetDirect).

### 3. Bluetooth (Serial RFCOMM)
Untuk printer thermal mini portable / mobile Bluetooth.

- Lakukan pairing printer Bluetooth di OS terlebih dahulu, lalu ikat ke port RFCOMM:
  ```bash
  sudo rfcomm bind 0 <MAC_ADDRESS_PRINTER>
  ```
- **Format Target**:
  ```json
  "mode": "bluetooth",
  "target": "/dev/rfcomm0"
  ```

### 4. Driver CUPS (Linux / macOS)
Jika printer menggunakan driver CUPS:
- **Format Target**: Nama printer di CUPS (bisa dicek dengan `lpstat -p`):
  ```json
  "mode": "cups",
  "target": "EPSON_TM_T82"
  ```

---

## 🔍 Fitur Auto-Detect Printer

Print Proxy dilengkapi modul pendeteksi otomatis di [src/helpers/auto-detect.js](file:///home/technoindo/print-proxy/src/helpers/auto-detect.js):

### 1. Scan Perangkat USB / Serial Lokal
- **Di Linux**:
  - Memeriksa file descriptor `/dev/usb/lp*`
  - Memeriksa USB Serial `/dev/ttyUSB*` dan `/dev/ttyACM*`
  - Memeriksa printer Bluetooth `/dev/rfcomm*`
  - Memeriksa daftar printer CUPS aktif via `lpstat -p`
- **Di Windows**:
  - Mengambil daftar printer dari WMI Windows melalui PowerShell (`Get-CimInstance Win32_Printer`).

### 2. Scan Jaringan LAN (Port 9100)
- Menjalankan TCP Handshake paralel ke seluruh rentang IP subnet (misal `192.168.1.1` s/d `192.168.1.254`).
- Timeout sangat cepat (~120ms per host dengan batching 30 koneksi simultan) sehingga selesai dalam beberapa detik saja.
- Mengembalikan daftar IP printer LAN yang aktif dan siap dipakai.

### 3. Menggunakan Auto-Detect dari Web Dashboard
1. Buka dashboard di `http://localhost:8000`.
2. Scroll ke bagian **Auto-Detect Printer**.
3. Klik tombol **`🔍 Scan Printer USB / Lokal`** atau **`🌐 Scan Printer LAN`**.
4. Hasil deteksi akan muncul dengan tombol **`+ Gunakan`** yang otomatis mengisi formulir pendaftaran kasir.
