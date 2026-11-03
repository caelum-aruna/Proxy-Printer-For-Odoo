# Referensi Lengkap API Endpoint

Print Proxy menyediakan antarmuka REST API dan JSON-RPC yang kompatibel penuh dengan Odoo POSBox, sistem POS kustom, serta aplikasi kasir pihak ketiga.

---

## 1. Odoo POSBox Emulator Endpoints

Endpoint ini dipanggil langsung oleh modul frontend Odoo POS (`ProxyDevice`).

### `POST /hw_proxy/status_json`
Memeriksa status driver dan koneksi hardware ke Odoo POS.
- **Header**: `Content-Type: application/json`
- **Body**: `{ "jsonrpc": "2.0", "method": "call", "params": {}, "id": 1 }`
- **Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "status": "connected",
    "drivers": {
      "escpos": { "status": "connected", "messages": [] }
    }
  }
}
```

### `POST /hw_proxy/print_xml_receipt` (atau `/hw_proxy/print_receipt`)
Mencetak struk kasir berbasis format QWeb XML Odoo.
- **Body**:
```json
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "receipt": "<receipt width=\"40\">\n  <line><left>Item A</left><right>10.000</right></line>\n</receipt>"
  },
  "id": 1
}
```
- **Response**: `{ "jsonrpc": "2.0", "id": 1, "result": true }`

### `POST /hw_proxy/open_cashbox`
Mengirimkan perintah pulsa elektrik ESC/POS untuk membuka laci kasir (*cash drawer*).
- **Body**: `{ "jsonrpc": "2.0", "id": 1 }`
- **Response**: `{ "jsonrpc": "2.0", "id": 1, "result": true }`

---

## 2. Cetak Struk Fleksibel (`/print/*`)

### `POST /print/receipt`
Endpoint serbaguna yang otomatis mendeteksi apakah data berupa **XML Receipt Odoo**, **Raw Binary / Dot Matrix**, atau **JSON Structured Order**.

- **Header / Query / Parameter Routing Printer**:
  - URL Port: `http://ip:8001/print/receipt`
  - URL Query: `/print/receipt?printer=kasir2`
  - Header: `x-printer: kasir2`
  - Body JSON: `{ "printer": "kasir2", ... }`

#### Contoh Payload 1: XML Receipt
```json
{
  "receipt": "<receipt align=\"center\"><line><bold>TOKO KITA</bold></line></receipt>"
}
```

#### Contoh Payload 2: JSON Structured Order (Aplikasi Kasir Sendiri)
```json
{
  "printer": "kasir1",
  "title": "KAFE NUSANTARA",
  "header": "Jl. Merdeka No. 45, Jakarta",
  "order_lines": [
    { "name": "Kopi Susu Gula Aren", "qty": 2, "price_unit": 18000, "price_subtotal": 36000 },
    { "name": "Roti Bakar Keju", "qty": 1, "price_unit": 20000, "price_subtotal": 20000 }
  ],
  "total": 56000,
  "cashier": "Budi",
  "footer": "Terima kasih atas kunjungan Anda!"
}
```

### `POST /print/raw`
Kirim teks biner mentah / escape code langsung ke printer tanpa parsing.
- **Body**:
```json
{
  "printer": "kasir1",
  "data": "Hello World\n\n\n\x1dV\x00"
}
```

### `POST /print/text`
Cetak teks polos sederhana via Thermal Printer.
- **Body**:
```json
{
  "printer": "kasir1",
  "text": "Antrian No: A-012"
}
```

---

## 3. Cetak Dot Matrix (`/dotmatrix/print`)

Untuk mencetak faktur continuous form / kertas rangkap (A4, Surat Jalan, Kwitansi) di printer Epson LX-300 / LX-310.

- **Endpoint**: `POST /dotmatrix/print`
- **Body**:
```json
{
  "printer": "dotmatrix",
  "header": "FAKTUR PENJUALAN",
  "customer": "PT Sumber Rejeki",
  "items": [
    { "code": "BRG-01", "name": "Beras Premium 5kg", "qty": 10, "unit": "Sak", "price": 75000, "total": 750000 }
  ],
  "total": 750000
}
```

---

## 4. Manajemen Konfigurasi Printer (`/printers/*`)

### `GET /printers`
Mengambil daftar seluruh printer yang terdaftar beserta status port dan alamat Odoo IP-nya.
- **Response**:
```json
{
  "defaultPrinter": "kasir1",
  "serverPort": 8000,
  "primaryIp": "192.168.1.50",
  "printers": [
    {
      "name": "kasir1",
      "mode": "usb",
      "target": "/dev/usb/lp0",
      "port": 8001,
      "type": "epson",
      "odooProxyIp": "192.168.1.50:8001",
      "isDefault": true
    }
  ]
}
```

### `GET /printers/next-port`
Mendapatkan nomor port berikutnya yang aman dan belum digunakan (misal `8003`).

### `POST /printers` (atau `/printers/register`)
Menambah atau memperbarui profil printer/kasir. Port listener langsung aktif seketika.
- **Body**:
```json
{
  "name": "kasir3",
  "mode": "usb",
  "target": "/dev/usb/lp2",
  "port": 8003,
  "type": "epson",
  "makeDefault": false
}
```

### `DELETE /printers/:name`
Menghapus printer profil dan otomatis menutup port listener-nya.
- **Contoh**: `DELETE /printers/kasir3`

### `POST /printers/test`
Mengirim tiket tes cetak ke printer tertentu.
- **Body**: `{ "printer": "kasir1" }`

### `POST /printers/cashbox`
Tes pemicu pembuka laci kasir.
- **Body**: `{ "printer": "kasir1" }`

---

## 5. Auto-Detect Endpoints

### `GET /printers/detect`
Melakukan pemindaian otomatis perangkat printer.
- **Query Params**:
  - `?scan_lan=true`: Sertakan pemindaian printer LAN port 9100.
  - `?subnet=192.168.1`: Subnet spesifik yang ingin di-scan (opsional).
- **Response**:
```json
{
  "os": "linux",
  "usbPrinters": [
    {
      "mode": "usb",
      "target": "/dev/usb/lp0",
      "name": "USB Printer (/dev/usb/lp0)",
      "description": "Direct USB Thermal/Dot-Matrix Printer"
    }
  ],
  "lanPrinters": [
    {
      "mode": "lan",
      "ip": "192.168.1.100",
      "port": 9100,
      "name": "Network Printer (192.168.1.100:9100)"
    }
  ]
}
```
