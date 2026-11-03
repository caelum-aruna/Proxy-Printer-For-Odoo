# Panduan Multi-Kasir & Multi-Printer Odoo POS

Dokumen ini menjelaskan cara menggunakan **satu komputer print-proxy** untuk melayani banyak kasir sekaligus, di mana setiap kasir mencetak ke printernya masing-masing secara terpisah dan otomatis.

---

## 🎯 Masalah Utama pada Odoo POS Standar

Secara bawaan, frontend Odoo POS (`point_of_sale/static/src/js/devices.js`) membaca alamat IP PosBox menggunakan kode berikut:

```javascript
// Odoo menghitung origin koneksi:
this.origin = url.protocol + '//' + url.host; 
```

**Konsekuensi:**
Jika Anda memasukkan alamat dengan sub-folder/path seperti:
`http://192.168.1.50:8000/kasir1`
Odoo akan **memotong `/kasir1`** dan tetap mengirim request ke `http://192.168.1.50:8000/hw_proxy/status_json`. Akibatnya, pemilahan kasir lewat URL path **tidak berhasil** di Odoo POS standar tanpa merombak file source code Odoo.

---

## 💡 Solusi Resmi: Dedicated Multi-Port Routing

Karena Odoo POS sepenuhnya mendukung format **`IP:PORT`**, Print Proxy menyediakan port terpisah untuk masing-masing kasir:

| Kasir | Port Dedicated | Alamat Proxy di Odoo POS | Target Fisik Printer |
| :--- | :--- | :--- | :--- |
| **Kasir 1** | `8001` | `192.168.1.50:8001` | USB Printer 1 (`/dev/usb/lp0`) |
| **Kasir 2** | `8002` | `192.168.1.50:8002` | USB Printer 2 (`/dev/usb/lp1`) |
| **Kasir 3** | `8003` | `192.168.1.50:8003` | USB Printer 3 (`/dev/usb/lp2`) |
| **Bar / Dapur** | `8004` | `192.168.1.50:8004` | LAN Printer (`192.168.1.100:9100`) |
| **Dashboard** | `8000` | `192.168.1.50:8000` | Port Utama & Web Dashboard |

> **Keuntungan Utama:**
> 1. **100% Standar Odoo**: Tidak perlu mengubah kode Python atau JavaScript Odoo bawaan.
> 2. **Dinamis Tanpa Restart**: Saat kasir baru ditambahkan melalui Web UI, port listener langsung aktif seketika.
> 3. **Independen**: Kasir 1 dan Kasir 2 bisa mencetak bersamaan tanpa saling mengganggu.

---

## ⚙️ Langkah Konfigurasi di Odoo POS

1. **Buka Odoo** $\rightarrow$ Masuk ke menu **Point of Sale**.
2. Buka menu **Configuration** $\rightarrow$ **Point of Sale**.
3. Pilih profil kasir yang ingin diatur (misal: **Shop / Kasir 1**):
   - Centang opsi **PoSBox / IoT Box** (atau *Hardware Proxy*).
   - Pada kolom **Proxy IP**, masukkan alamat IP komputer proxy beserta port kasir:
     ```
     192.168.1.50:8001
     ```
   - Centang opsi **Receipt Printer**.
   - (Opsional) Centang opsi **Cashdrawer** jika printer terhubung ke laci kasir RJ11.
4. Klik **Save**.
5. Ulangi untuk **Kasir 2**:
   - Buka profil **Shop / Kasir 2**.
   - Pada kolom **Proxy IP**, masukkan:
     ```
     192.168.1.50:8002
     ```
   - Klik **Save**.

---

## 🖱️ Menambah Kasir Baru Lewat Web Dashboard

Anda tidak perlu mengedit file kodingan secara manual. Cukup gunakan dashboard web:

1. Buka browser: `http://localhost:8000` (atau `http://<IP-PROXY>:8000`).
2. Klik tombol hijau **`+ Tambah Printer / Kasir Baru`** di bagian atas kanan.
3. Isi formulir:
   - **ID / Nama Kasir**: Masukkan nama pengenal (contoh: `kasir3` atau `dapur`).
   - **Jenis Koneksi**: Pilih `USB`, `LAN`, `Bluetooth`, atau `CUPS`.
   - **Port Odoo Dedicated**: Otomatis terisi nomor port berikutnya yang belum terpakai (misal `8003`).
   - **Target / Path Device**: Masukkan path printer (contoh `/dev/usb/lp2` atau gunakan hasil scan otomatis).
4. Klik **Simpan Printer**.
5. Port baru langsung aktif saat itu juga. Klik tombol **Salin IP** pada kartu kasir dan tempelkan ke Odoo POS.

---

## 📄 Struktur Data di `printers.json`

Semua pengaturan di atas tersimpan secara persisten di file [printers.json](file:///home/technoindo/print-proxy/printers.json):

```json
{
  "serverPort": 8000,
  "defaultPrinter": "kasir1",
  "printers": {
    "kasir1": {
      "port": 8001,
      "mode": "usb",
      "target": "/dev/usb/lp0",
      "type": "epson"
    },
    "kasir2": {
      "port": 8002,
      "mode": "usb",
      "target": "/dev/usb/lp1",
      "type": "epson"
    },
    "dapurLan": {
      "port": 8003,
      "mode": "lan",
      "target": {
        "address": "192.168.1.100",
        "port": 9100
      },
      "type": "epson"
    }
  }
}
```
Jika file ini Anda salin ke komputer lain, seluruh konfigurasi kasir dan port akan otomatis termuat sama persis.
