// src/routes/posbox.js
// Odoo PosBox emulator endpoints (dipanggil oleh Odoo POS standar / ProxyDevice)

const express = require("express");
const config = require("../../config");
const { buildPrinter } = require("../helpers/printer-builder");
const { renderXmlReceipt } = require("../helpers/xml-renderer");
const { printRawData } = require("../helpers/raw-printer");
const { getAllPrinters } = require("../helpers/config-manager");

const router = express.Router({ mergeParams: true });

// Anti-cache middleware agar response selalu instan 200 OK (<1ms) dan tidak mengembalikan 304 Not Modified
router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

function getRequestedPrinter(req) {
  const dynamicConfig = getAllPrinters();
  const allPrinters = { ...config.printers, ...(dynamicConfig.printers || {}) };

  // 1. Port-based routing (jika Odoo connect ke port khusus misal 8001 -> tp1)
  const localPort = req.socket && req.socket.localPort;
  if (localPort) {
    if (config.portMapping && config.portMapping[localPort]) {
      return config.portMapping[localPort];
    }
    for (const [name, p] of Object.entries(allPrinters)) {
      if (p.port && p.port === localPort) return name;
    }
  }

  // 2. Parameter URL path (:printer, e.g. /kasir1/hw_proxy/...)
  if (req.params && req.params.printer) return req.params.printer;
  const match = req.originalUrl && req.originalUrl.match(/^\/([^\/\?]+)\/(hw_proxy|hw_drivers)/);
  if (match && match[1]) return match[1];

  // 3. Query parameter (?printer=tp1)
  if (req.query && req.query.printer) return req.query.printer;

  // 4. Body parameter
  if (req.body && req.body.printer) return req.body.printer;
  if (req.body && req.body.params && req.body.params.printer) return req.body.params.printer;

  // 5. Header (x-printer: tp1)
  if (req.headers && req.headers["x-printer"]) return req.headers["x-printer"];

  // 6. IP mapping jika ada di config (misal IP laptop kasir -> nama printer)
  if (config.ipMapping) {
    const clientIp = (req.ip || req.connection.remoteAddress || "").replace(/^.*:/, "");
    if (config.ipMapping[clientIp]) return config.ipMapping[clientIp];
  }

  // 7. Default fallback
  if (dynamicConfig.defaultPrinter && allPrinters[dynamicConfig.defaultPrinter]) {
    return dynamicConfig.defaultPrinter;
  }
  if (config.defaultPrinter && allPrinters[config.defaultPrinter]) {
    return config.defaultPrinter;
  }

  // 8. Jika hanya ada 1 printer terdaftar, otomatis gunakan itu
  const printerKeys = Object.keys(allPrinters);
  if (printerKeys.length === 1) {
    return printerKeys[0];
  }

  return dynamicConfig.defaultPrinter || config.defaultPrinter || (printerKeys.length > 0 ? printerKeys[0] : "");
}

/**
 * Eksekusi print job dari Odoo (mendukung XML Odoo receipt dan raw ESC/POS).
 */
async function executeOdooPrint(req, receiptData) {
  const printerName = getRequestedPrinter(req);
  if (!receiptData) {
    throw new Error("Data struk (receipt) kosong");
  }

  // Cek apakah data adalah format XML (<receipt ...)
  const isXml = typeof receiptData === "string" && receiptData.includes("<receipt");

  if (isXml) {
    const printer = buildPrinter({ printerName });
    await renderXmlReceipt(printer, receiptData);
    await printer.execute();
    console.log(`[POSBox] Berhasil mencetak XML receipt dari Odoo ke printer: '${printerName}'`);
    return true;
  }

  // Jika berupa string Base64 atau data mentah ESC/POS
  let rawBuffer = null;
  if (Buffer.isBuffer(receiptData)) {
    rawBuffer = receiptData;
  } else if (typeof receiptData === "string") {
    // Cek apakah base64 encoded
    const cleanStr = receiptData.trim();
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(cleanStr) && cleanStr.length % 4 === 0) {
      try {
        const decoded = Buffer.from(cleanStr, "base64");
        if (decoded.length > 0) {
          rawBuffer = decoded;
        }
      } catch (e) {}
    }
    if (!rawBuffer) {
      rawBuffer = Buffer.from(receiptData, "binary");
    }
  }

  if (rawBuffer && rawBuffer.length > 0) {
    await printRawData({ printerName, data: rawBuffer });
    console.log(`[POSBox] Berhasil mencetak raw ESC/POS receipt ke printer: '${printerName}'`);
    return true;
  }

  throw new Error("Format struk tidak dikenali (bukan XML valid dan bukan buffer ESC/POS)");
}

// Status POSBox / IoT Box
router.all(["/status_json", "/status"], (req, res) => {
  const id = (req.body && req.body.id) || 1;
  const printerName = getRequestedPrinter(req);
  const dynamicConfig = getAllPrinters();
  const allPrinters = { ...config.printers, ...(dynamicConfig.printers || {}) };
  const hasPrinter = Boolean(printerName && allPrinters[printerName]);

  const messages = [];
  if (!hasPrinter) {
    messages.push("Belum ada printer yang terdaftar di print proxy");
  }

  const statusObj = {
    status: "connected",
    escpos: { status: hasPrinter ? "connected" : "connecting", messages },
    printer: { status: hasPrinter ? "connected" : "connecting", messages },
    scanner: { status: "connected", messages: [] },
    scale: { status: "connected", messages: [] },
    display: { status: "connected", messages: [] },
    drivers: {
      escpos: { status: hasPrinter ? "connected" : "connecting", messages },
      printer: { status: hasPrinter ? "connected" : "connecting", messages },
      scanner: { status: "connected", messages: [] },
      scale: { status: "connected", messages: [] },
      display: { status: "connected", messages: [] },
    },
  };
  res.json({
    jsonrpc: "2.0",
    id,
    result: statusObj,
    status: "connected",
    ...statusObj,
  });
});

// Ping
router.all("/hello", (req, res) => {
  res.send("ping");
});

// Handshake
router.all("/handshake", (req, res) => {
  const id = (req.body && req.body.id) || 1;
  res.json({ jsonrpc: "2.0", id, result: true, status: "ok" });
});

// Dukungan Odoo Modern IoT Box (v16, v17, v18)
router.all("/check_certificate", (req, res) => {
  res.json({ status: "ok", valid: true });
});

// Endpoint /action untuk Odoo Modern IoT Box (v15, v16, v17, v18)
router.post("/action", async (req, res) => {
  const id = (req.body && req.body.id) || 1;
  const params = (req.body && req.body.params) || {};
  const action = params.action;

  console.log(`[IoTBox Action] Menerima action: '${action}'`);

  try {
    // 1. Aksi cetak struk dari Odoo Modern
    if (action === "print_receipt" || action === "print_xml_receipt" || action === "print") {
      const receiptData = params.receipt || params.data || req.body.receipt || req.body.data;
      if (!receiptData) {
        return res.status(400).json({ jsonrpc: "2.0", id, error: { message: "Receipt data is missing in action" } });
      }
      await executeOdooPrint(req, receiptData);
      return res.json({ jsonrpc: "2.0", id, result: true });
    }

    // 2. Aksi buka laci kasir
    if (action === "open_cashbox" || action === "cashbox") {
      const printerName = getRequestedPrinter(req);
      const printer = buildPrinter({ printerName });
      printer.openCashDrawer();
      await printer.execute();
      console.log(`[IoTBox Action] Laci kasir dibuka via printer '${printerName}'`);
      return res.json({ jsonrpc: "2.0", id, result: true });
    }

    // 3. Aksi status tiket
    if (action === "print_status") {
      const printerName = getRequestedPrinter(req);
      const printer = buildPrinter({ printerName });
      printer.alignCenter();
      printer.println("POSBOX STATUS TICKET");
      printer.println("--------------------");
      printer.println(`Printer: ${printerName}`);
      printer.println(`Waktu  : ${new Date().toLocaleString("id-ID")}`);
      printer.cut();
      await printer.execute();
      return res.json({ jsonrpc: "2.0", id, result: true });
    }

    // Aksi lainnya (display, scale, dll.)
    res.json({ jsonrpc: "2.0", id, result: true });
  } catch (err) {
    console.error(`[IoTBox Action] Error pada action '${action}':`, err.message);
    res.status(500).json({ jsonrpc: "2.0", id, error: { message: err.message } });
  }
});

// Buka laci kasir
router.post("/open_cashbox", async (req, res) => {
  const id = (req.body && req.body.id) || 1;
  const printerName = getRequestedPrinter(req);
  try {
    const printer = buildPrinter({ printerName });
    printer.openCashDrawer();
    await printer.execute();
    res.json({ jsonrpc: "2.0", id, result: true });
  } catch (err) {
    res.status(500).json({ jsonrpc: "2.0", id, error: { message: err.message } });
  }
});

// Cetak struk POS Odoo bawaan (XML Receipt) & Modul Kustom (Struk KJS, ESC/POS)
router.post(["/print_xml_receipt", "/print_receipt", "/print_xml", "/print", "/print_escpos"], async (req, res) => {
  const id = (req.body && req.body.id) || 1;
  const receiptData = (req.body && req.body.params && (req.body.params.receipt || req.body.params.data)) ||
                      (req.body && (req.body.receipt || req.body.data)) ||
                      (typeof req.body === "string" ? req.body : null);

  if (!receiptData) {
    return res.status(400).json({ jsonrpc: "2.0", id, error: { message: "Receipt XML/ESC-POS data is missing" } });
  }

  const printerName = getRequestedPrinter(req);

  try {
    await executeOdooPrint(req, receiptData);
    res.json({ jsonrpc: "2.0", id, result: true });
  } catch (err) {
    console.error(`[POSBox] Gagal mencetak receipt ke '${printerName}':`, err.message);
    res.status(500).json({ jsonrpc: "2.0", id, error: { message: err.message } });
  }
});

module.exports = router;
