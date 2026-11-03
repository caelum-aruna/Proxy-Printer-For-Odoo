// config.js
// Kamu bisa daftarkan beberapa printer sekaligus (mis. kasir 1 pakai USB,
// kasir 2 pakai LAN, printer dapur pakai Bluetooth). Saat mencetak, tinggal
// sebut nama profilnya di request, atau kirim koneksi ad-hoc (lihat README).

// Deteksi OS otomatis: Windows (win32) vs Linux (linux) vs macOS (darwin)
const isWindows = process.platform === "win32";

module.exports = {
  // Port HTTP server proxy utama (Dashboard Web)
  serverPort: 8000,

  // Profil default kalau request tidak menyebutkan printer mana yang dipakai.
  // Kosong saat pertama kali — user pilih sendiri lewat dashboard UI.
  defaultPrinter: "",

  // Daftar printer.
  // Kosong saat pertama kali — user bebas menambahkan printer kasir thermal,
  // dotmatrix, LAN, dll. melalui dashboard UI tanpa perlu edit file ini.
  // Setelah ditambahkan, konfigurasi tersimpan otomatis di printers.json.
  printers: {},

  // Lebar kertas printer: 48 karakter (standar kertas thermal 80mm / PosBox bawaan)
  // atau 33 karakter jika menggunakan printer mini 58mm
  charsPerLine: 33,
};
