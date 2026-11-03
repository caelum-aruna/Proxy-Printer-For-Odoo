// src/routes/status.js
// Endpoint daftar printer, cek status koneksi, dan AUTO-DETECT printer

const express = require("express");
const config = require("../../config");
const { buildPrinter } = require("../helpers/printer-builder");
const { printRawData } = require("../helpers/raw-printer");
const {
  detectUsbPrinters,
  detectLanPrinters,
  detectAllPrinters,
} = require("../helpers/auto-detect");
const { exec } = require("child_process");

const router = express.Router();

// Favicon handler agar tidak memicu 404 di browser console
router.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

function resolveTarget(target) {
  if (target && typeof target === "object" && !target.address) {
    return target[process.platform] || target.linux || target.win32;
  }
  return target;
}

const os = require("os");

function getPrimaryLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const netInfo of ifaces[name]) {
      if (netInfo.family === "IPv4" && !netInfo.internal) {
        return netInfo.address;
      }
    }
  }
  return "localhost";
}

const {
  savePrinter,
  deletePrinter,
  getAllPrinters,
  setDefaultPrinter: setConfigDefaultPrinter,
  getNextAvailablePort,
} = require("../helpers/config-manager");

// ---------------------------------------------------------------------------
// 1. DAFTAR & STATUS PRINTER TERDAFTAR
// ---------------------------------------------------------------------------

// GET /printers — daftar semua printer yang saat ini aktif di konfigurasi
router.get("/printers", (req, res) => {
  const data = getAllPrinters();
  const primaryIp = getPrimaryLocalIp();
  const list = Object.entries(data.printers || {}).map(([name, p]) => {
    const port = p.port || data.serverPort;
    return {
      name,
      mode: p.mode,
      target: resolveTarget(p.target),
      port: p.port || null,
      type: p.type || "epson",
      odooProxyIp: `${primaryIp}:${port}`,
      isDefault: name === data.defaultPrinter,
    };
  });
  res.json({
    defaultPrinter: data.defaultPrinter,
    serverPort: data.serverPort,
    primaryIp,
    printers: list,
    ipMapping: config.ipMapping || {},
  });
});

// GET /printers/next-port — port berikutnya yang tersedia untuk kasir baru
router.get("/printers/next-port", (req, res) => {
  res.json({ nextPort: getNextAvailablePort() });
});

const fs = require("fs");
const path = require("path");
const { getQueueStatus } = require("../helpers/print-queue");
const { LOGS_DIR } = require("../helpers/logger");

// GET /system-info — informasi sistem dan proxy
router.get("/system-info", (req, res) => {
  const data = getAllPrinters();
  const primaryIp = getPrimaryLocalIp();
  res.json({
    status: "online",
    os: process.platform,
    hostname: os.hostname(),
    primaryIp: primaryIp,
    port: data.serverPort,
    defaultPrinter: data.defaultPrinter,
    nodeVersion: process.version,
    registeredCount: Object.keys(data.printers || {}).length,
    queue: getQueueStatus(),
  });
});

// GET /logs — ambil riwayat 100 baris log terakhir hari ini untuk diagnosa
router.get("/logs", (req, res) => {
  try {
    const pad = (n) => String(n).padStart(2, "0");
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const filePath = path.join(LOGS_DIR, `print-proxy-${dateStr}.log`);

    if (!fs.existsSync(filePath)) {
      return res.json({ lines: [], date: dateStr, total: 0 });
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const allLines = content.split("\n").filter(Boolean);
    const lastLines = allLines.slice(-100);
    res.json({ lines: lastLines, total: allLines.length, date: dateStr });
  } catch (err) {
    res.status(500).json({ error: "Gagal membaca log: " + err.message });
  }
});

// GET /status — cek koneksi printer tertentu
router.get("/status", async (req, res) => {
  try {
    const printer = buildPrinter({ printerName: req.query.printer });
    const connected = await printer.isPrinterConnected();
    res.json({ connected });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// POST /printers/test — test cetak struk dari dashboard (mendukung thermal, dot matrix, dan printer biasa)
router.post("/printers/test", async (req, res) => {
  const { printer: printerName } = req.body || {};
  const all = getAllPrinters();
  const pName = printerName || all.defaultPrinter || config.defaultPrinter;
  const profile = (all.printers && all.printers[pName]) || (config.printers && config.printers[pName]) || {};
  const mode = (profile.mode || "").toLowerCase();
  const type = (profile.type || "").toLowerCase();
  const target = String(profile.target || "").toLowerCase();

  const isDotMatrixOrStandard =
    (pName && pName.toLowerCase().includes("dotmatrix")) ||
    type.includes("dot") ||
    type.includes("matrix") ||
    type.includes("standard") ||
    mode === "standard" ||
    mode === "gdi" ||
    /series|ink|canon|deskjet|laserjet|pdf|xps|l220|l3210/.test(target);

  try {
    if (isDotMatrixOrStandard) {
      // Format teks monospace untuk Dot Matrix (ESC/P) dan Printer Biasa (GDI/Out-Printer)
      // Tanpa kode thermal cutter (printer.cut) agar printer biasa / dotmatrix tidak membuang job
      const dateStr = new Date().toLocaleString("id-ID");
      const testContent = [
        "============================================================",
        "                  PRINT PROXY - TEST PRINT                  ",
        "============================================================",
        `Printer   : ${pName}`,
        `Target    : ${profile.target || "-"}`,
        `Tipe/Mode : ${(profile.mode || "standard").toUpperCase()}`,
        `Waktu     : ${dateStr}`,
        `OS        : ${process.platform.toUpperCase()}`,
        "------------------------------------------------------------",
        "Status    : BERHASIL TERHUBUNG & SIAP MENCETAK",
        "Engine    : Dual-Mode (Dot Matrix ESC/P & Printer Biasa GDI)",
        "------------------------------------------------------------",
        "Tes Huruf & Angka:",
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        "abcdefghijklmnopqrstuvwxyz",
        "0123456789 - !@#$%^&*()_+ []:;,.",
        "============================================================",
        "\r\n\r\n\r\n\x0C", // Line feeds dan Form Feed (eject)
      ].join("\r\n");

      await printRawData({
        printerName: pName,
        data: testContent,
        mode: (mode === "standard" || mode === "gdi") ? "text" : "auto",
      });

      return res.json({
        success: true,
        message: `Test print teks berhasil dikirim ke '${pName}' (Mode Dotmatrix / Printer Biasa)`,
      });
    }

    // Printer Thermal Kasir Standar (ESC/POS)
    const printer = buildPrinter({ printerName: pName });
    printer.alignCenter();
    printer.setTextDoubleHeight();
    printer.println("PRINT PROXY TEST");
    printer.setTextNormal();
    printer.println("--------------------------------");
    printer.println(`Printer : ${pName}`);
    printer.println(`Waktu   : ${new Date().toLocaleString("id-ID")}`);
    printer.println(`OS      : ${process.platform.toUpperCase()}`);
    printer.println("--------------------------------");
    printer.alignLeft();
    printer.println("Status : BERHASIL TERHUBUNG");
    printer.println("Bridge : Odoo POS & Thermal Receipt");
    printer.println("--------------------------------");
    printer.alignCenter();
    printer.println("Siap mencetak transaksi!");
    printer.println("");
    printer.cut();
    await printer.execute();
    res.json({ success: true, message: `Test print thermal berhasil dikirim ke '${pName}'` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /printers/clear-queue — batalkan/hapus antrean job yang macet di OS
router.post("/printers/clear-queue", (req, res) => {
  const isWindows = process.platform === "win32";
  if (isWindows) {
    exec("powershell -NoProfile -Command \"Get-Printer | Get-PrintJob | Remove-PrintJob -ErrorAction SilentlyContinue\"", (err) => {
      if (err) {
        return res.status(500).json({ success: false, error: "Gagal membersihkan antrean Windows: " + err.message });
      }
      res.json({ success: true, message: "Antrean print spooler Windows berhasil dibersihkan" });
    });
  } else {
    exec("cancel -a 2>/dev/null || true", () => {
      res.json({ success: true, message: "Antrean cetak Linux berhasil dibersihkan" });
    });
  }
});

// POST /printers/cashbox — test buka laci kasir
router.post("/printers/cashbox", async (req, res) => {
  const { printer: printerName } = req.body || {};
  try {
    const printer = buildPrinter({ printerName });
    printer.openCashDrawer();
    await printer.execute();
    res.json({ success: true, message: "Perintah buka laci kasir berhasil dikirim" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 2. AUTO-DETECT PRINTER
// ---------------------------------------------------------------------------

// GET /printers/detect — scan printer otomatis (USB langsung, tambahkan ?scan_lan=true untuk scan LAN)
router.get("/printers/detect", async (req, res) => {
  try {
    const scanLan = req.query.scan_lan === "true" || req.query.lan === "true";
    const subnet = req.query.subnet;
    const result = await detectAllPrinters({ scanLan, subnet });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Gagal mendeteksi printer: " + err.message });
  }
});

// GET /printers/detect/usb — scan printer USB / Serial lokal saja
router.get("/printers/detect/usb", async (req, res) => {
  try {
    const usbPrinters = await detectUsbPrinters();
    res.json({ os: process.platform, total: usbPrinters.length, printers: usbPrinters });
  } catch (err) {
    res.status(500).json({ error: "Gagal mendeteksi printer USB: " + err.message });
  }
});

// GET /printers/detect/lan — scan printer di jaringan LAN (port 9100)
router.get("/printers/detect/lan", async (req, res) => {
  try {
    const subnet = req.query.subnet;
    const start = req.query.start ? parseInt(req.query.start, 10) : 1;
    const end = req.query.end ? parseInt(req.query.end, 10) : 254;
    const port = req.query.port ? parseInt(req.query.port, 10) : 9100;

    const lanPrinters = await detectLanPrinters({ subnet, start, end, port });
    res.json({ total: lanPrinters.length, printers: lanPrinters });
  } catch (err) {
    res.status(500).json({ error: "Gagal scan printer LAN: " + err.message });
  }
});

// ---------------------------------------------------------------------------
// 3. CRUD PRINTER DINAMIS & PERSISTEN (TANPA HARDCODE & TANPA RESTART)
// ---------------------------------------------------------------------------

// POST /printers — tambah atau perbarui printer profil baru
router.post("/printers", (req, res) => {
  const { name, mode, target, port, type, makeDefault } = req.body || {};

  if (!name || !mode || !target) {
    return res.status(400).json({
      error: "Field 'name', 'mode' (usb|bluetooth|lan|cups), dan 'target' wajib diisi",
    });
  }

  try {
    const saved = savePrinter(name, { mode, target, port, type, makeDefault });
    console.log(`[Printer] Profil '${name}' berhasil disimpan:`, saved);
    res.json({
      success: true,
      message: `Printer '${name}' berhasil disimpan`,
      printer: saved,
      data: getAllPrinters(),
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal menyimpan printer: " + err.message });
  }
});

// Alias POST /printers/register
router.post("/printers/register", (req, res) => {
  const { name, mode, target, port, type, makeDefault } = req.body || {};
  if (!name || !mode || !target) {
    return res.status(400).json({
      error: "Field 'name', 'mode' (usb|bluetooth|lan|cups), dan 'target' wajib diisi",
    });
  }
  try {
    const saved = savePrinter(name, { mode, target, port, type, makeDefault });
    res.json({
      success: true,
      message: `Printer '${name}' berhasil didaftarkan`,
      printer: saved,
      data: getAllPrinters(),
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal mendaftarkan printer: " + err.message });
  }
});

// DELETE /printers/:name — hapus profil printer
router.delete("/printers/:name", (req, res) => {
  try {
    const result = deletePrinter(req.params.name);
    console.log(`[Printer] Profil '${req.params.name}' berhasil dihapus.`);
    res.json({
      success: true,
      message: `Printer '${req.params.name}' berhasil dihapus`,
      data: getAllPrinters(),
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal menghapus printer: " + err.message });
  }
});

// POST /printers/:name/default — jadikan default printer
router.post("/printers/:name/default", (req, res) => {
  try {
    const defaultName = setConfigDefaultPrinter(req.params.name);
    res.json({
      success: true,
      message: `Printer '${defaultName}' dijadikan default`,
      defaultPrinter: defaultName,
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengatur default printer: " + err.message });
  }
});

// POST /printers/auto-configure — otomatis pilih printer USB pertama yang terdeteksi dan jadikan default
router.post("/printers/auto-configure", async (req, res) => {
  try {
    const detected = await detectUsbPrinters();
    if (detected.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tidak ada printer USB/lokal yang terdeteksi",
      });
    }

    const first = detected[0];
    const profileName = req.body.name || "kasirAuto";
    const saved = savePrinter(profileName, {
      ...first.recommendedConfig,
      makeDefault: true,
    });

    console.log(`[AutoConfig] Printer '${profileName}' otomatis dikonfigurasi ke:`, first.target);

    res.json({
      success: true,
      message: `Printer '${profileName}' berhasil dikonfigurasi otomatis`,
      configuredPrinter: saved,
      allDetected: detected,
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal auto-configure: " + err.message });
  }
});

module.exports = router;
