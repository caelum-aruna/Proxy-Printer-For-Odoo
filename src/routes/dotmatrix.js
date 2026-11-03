// src/routes/dotmatrix.js
// Endpoint cetak dot matrix (Surat Jalan, Invoice, PO, SO, Picking Note)

const express = require("express");
const { printRawData } = require("../helpers/raw-printer");

const router = express.Router();

// POST /dotmatrix/print
router.post("/print", async (req, res) => {
  const printerData = req.body.printer_data || req.body.text || req.body.data || (typeof req.body === "string" ? req.body : null);
  const printerName = req.body.printer || "dotmatrix";

  if (!printerData) {
    return res.status(400).json({ status: "ERROR", error: "Field 'printer_data' tidak boleh kosong" });
  }

  try {
    await printRawData({ printerName, connection: req.body.connection, data: printerData });
    console.log(`[DotMatrix] Berhasil mencetak ke printer: ${printerName}`);
    res.json({ status: "OK", success: true });
  } catch (err) {
    console.error("[DotMatrix] Gagal cetak:", err.message);
    res.status(500).json({ status: "ERROR", error: err.message });
  }
});

module.exports = router;
