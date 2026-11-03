// src/routes/receipt.js
// Endpoint /print/receipt — auto-detect XML receipt Odoo, raw text, atau JSON order

const express = require("express");
const config = require("../../config");
const { buildPrinter } = require("../helpers/printer-builder");
const { renderXmlReceipt } = require("../helpers/xml-renderer");
const { printRawData } = require("../helpers/raw-printer");
const { formatRupiah, printLeftRight } = require("../helpers/format");
const { getAllPrinters } = require("../helpers/config-manager");

const router = express.Router();

function getRequestedPrinter(req) {
  const dynamicConfig = getAllPrinters();

  // Port-based routing
  const localPort = req.socket && req.socket.localPort;
  if (localPort) {
    if (config.portMapping && config.portMapping[localPort]) {
      return config.portMapping[localPort];
    }
    const allPrinters = { ...config.printers, ...(dynamicConfig.printers || {}) };
    for (const [name, p] of Object.entries(allPrinters)) {
      if (p.port && p.port === localPort) return name;
    }
  }

  if (req.params && req.params.printer) return req.params.printer;
  if (req.query && req.query.printer) return req.query.printer;
  if (req.body && req.body.printer) return req.body.printer;
  if (req.body && req.body.params && req.body.params.printer) return req.body.params.printer;
  if (req.headers && req.headers["x-printer"]) return req.headers["x-printer"];
  if (config.ipMapping) {
    const clientIp = (req.ip || req.connection.remoteAddress || "").replace(/^.*:/, "");
    if (config.ipMapping[clientIp]) return config.ipMapping[clientIp];
  }
  return dynamicConfig.defaultPrinter || config.defaultPrinter;
}

// POST /print/receipt
router.post("/", async (req, res) => {
  const targetPrinter = getRequestedPrinter(req);

  // 1. XML Receipt Odoo (<receipt>...</receipt>)
  let receiptXml = null;
  if (typeof req.body === "string" && req.body.includes("<receipt")) {
    receiptXml = req.body;
  } else if (req.body && req.body.receipt && typeof req.body.receipt === "string" && req.body.receipt.includes("<receipt")) {
    receiptXml = req.body.receipt;
  } else if (req.body && req.body.params && req.body.params.receipt) {
    receiptXml = req.body.params.receipt;
  }

  if (receiptXml) {
    try {
      const printer = buildPrinter({ printerName: targetPrinter, connection: req.body.connection });
      await renderXmlReceipt(printer, receiptXml);
      await printer.execute();
      console.log(`[Receipt] Berhasil mencetak XML receipt Odoo ke printer: '${targetPrinter}'`);
      return res.json({ success: true });
    } catch (err) {
      console.error(`[Receipt] Gagal mencetak XML receipt ke '${targetPrinter}':`, err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 2. Raw Text / Dot Matrix printer data
  if (req.body && (req.body.printer_data || req.body.raw)) {
    const data = req.body.printer_data || req.body.raw;
    try {
      await printRawData({ printerName: req.body.printer, connection: req.body.connection, data });
      return res.json({ success: true, status: "OK" });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 3. JSON items (dari modul POS kustom) -> cetak dinamis
  const {
    printer: printerName, connection, storeName, orderRef, items, total, footer,
    cashier, clientName, date, subtotal, taxDetails, totalDiscount,
    paymentLines, change, totalSavings, pickingAddress,
    receiptTitle, partnerLabel
  } = req.body || {};

  if (Array.isArray(items) && items.length > 0) {
    try {
      const printer = buildPrinter({ printerName, connection });
      const receiptWidth = config.charsPerLine || 48;

      printer.alignCenter();
      if (storeName) {
        printer.setTextDoubleHeight();
        printer.println(storeName);
        printer.setTextNormal();
      }
      if (receiptTitle) printer.println(receiptTitle);
      if (cashier) {
        const role = (partnerLabel === 'Vendor') ? 'Petugas' : 'Kasir';
        printer.println(`${role}: ${cashier}`);
      }
      if (clientName) {
        const pLabel = partnerLabel || 'Pelanggan';
        printer.println(`${pLabel}: ${clientName}`);
      }
      if (date) printer.println(date);
      if (orderRef) printer.println(orderRef);
      printer.println("-".repeat(receiptWidth));

      printer.alignLeft();
      items.forEach((item) => {
        const qty = item.qty ?? 1;
        const price = item.price ?? 0;
        const discount = item.discount ?? 0;
        const unitName = item.unit_name || "Unit(s)";
        const priceDisplay = item.price_display ?? (qty * price);
        const simple = (discount === 0 && unitName === "Unit(s)" && qty === 1);

        if (simple) {
          printLeftRight(printer, item.name, formatRupiah(priceDisplay), receiptWidth);
        } else {
          printer.println(item.name);
          if (discount !== 0) printer.println(`  Discount: ${discount}%`);
          let qtyStr = `${qty}`;
          if (unitName !== "Unit(s)") qtyStr += ` ${unitName}`;
          printLeftRight(printer, `  ${qtyStr} x ${formatRupiah(price)}`, formatRupiah(priceDisplay), receiptWidth);
        }
      });

      if (totalDiscount) {
        printLeftRight(printer, "Tot. Diskon", `= ${formatRupiah(totalDiscount)}`, receiptWidth);
      }

      const isTaxIncluded = Math.abs((subtotal || 0) - (total || 0)) <= 0.000001;
      if (!isTaxIncluded && subtotal) {
        printer.alignRight();
        printer.println("--------");
        printLeftRight(printer, "Subtotal", formatRupiah(subtotal), receiptWidth);
        if (taxDetails && taxDetails.length > 0) {
          taxDetails.forEach(tax => {
            printLeftRight(printer, tax.name, formatRupiah(tax.amount), receiptWidth);
          });
        }
      }

      printer.alignRight();
      printer.println("--------");
      printer.setTextDoubleHeight();
      printLeftRight(printer, "TOTAL", formatRupiah(total), receiptWidth);
      printer.setTextNormal();

      if (paymentLines && paymentLines.length > 0) {
        paymentLines.forEach(payment => {
          printLeftRight(printer, payment.name, formatRupiah(payment.amount), receiptWidth);
        });
      }

      if (change !== undefined) {
        printer.setTextDoubleHeight();
        printLeftRight(printer, "KEMBALIAN", formatRupiah(change), receiptWidth);
        printer.setTextNormal();
      }

      if (totalSavings) {
        printLeftRight(printer, "ANDA HEMAT", formatRupiah(totalSavings), receiptWidth);
      }

      printer.println("");
      printer.alignCenter();
      printer.println(footer || "Terima Kasih");
      printer.println("");

      printer.cut();
      await printer.execute();
      console.log("[Receipt] Berhasil mencetak transaksi JSON (tax_transaction)");
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(400).json({ error: "Payload tidak valid (kirim 'receipt' XML, 'printer_data', atau 'items' JSON)" });
});

module.exports = router;
