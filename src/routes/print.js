// src/routes/print.js
// Endpoint /print/raw dan /print/text

const express = require("express");
const { buildPrinter } = require("../helpers/printer-builder");
const { printRawData } = require("../helpers/raw-printer");

const router = express.Router();

// POST /print/raw — kirim byte mentah langsung ke printer
router.post("/raw", async (req, res) => {
  const data = req.body.data || req.body.text || req.body.printer_data || (typeof req.body === "string" ? req.body : null);
  const { printer: printerName, connection } = req.body || {};

  if (!data) return res.status(400).json({ error: "field 'data' wajib diisi" });

  try {
    await printRawData({ printerName, connection, data });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /print/text — teks polos via thermal printer
router.post("/text", async (req, res) => {
  const { printer: printerName, connection, text } = req.body || {};
  if (!text) return res.status(400).json({ error: "field 'text' wajib diisi" });

  try {
    const printer = buildPrinter({ printerName, connection });
    printer.alignCenter();
    printer.println(text);
    printer.cut();
    await printer.execute();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
