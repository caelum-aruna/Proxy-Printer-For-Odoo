// src/helpers/printer-builder.js
// Membuat instance ThermalPrinter berdasarkan profil config atau koneksi ad-hoc
// Mendukung Windows (via native Spooler adapter), Linux (/dev/usb/lp* & CUPS), dan LAN Network.
// Terintegrasi dengan In-Memory FIFO Print Queue dan Logger.

const { printer: ThermalPrinter, types: PrinterTypes } = require("node-thermal-printer");
const config = require("../../config");
const { getAllPrinters } = require("./config-manager");
const { WindowsSpoolerInterface } = require("./windows-spooler");
const { enqueuePrint } = require("./print-queue");
const logger = require("./logger");

const isWindows = process.platform === "win32";

function resolveTarget(target) {
  if (target && typeof target === "object" && !target.address) {
    return target[process.platform] || target.linux || target.win32;
  }
  return target;
}

/**
 * Build instance node-thermal-printer dengan pengantrean eksekusi otomatis.
 * @param {{ printerName?: string, connection?: { mode: string, target: any, type?: string } }} opts
 * @returns {ThermalPrinter}
 */
function buildPrinter({ printerName, connection } = {}) {
  let mode, target;
  const all = getAllPrinters();

  if (connection) {
    mode = connection.mode;
    target = resolveTarget(connection.target);
  } else {
    const name = printerName || all.defaultPrinter || config.defaultPrinter;
    if (!name) {
      throw new Error("Belum ada printer terdaftar. Silakan tambahkan printer melalui dashboard UI terlebih dahulu.");
    }
    const profile = (all.printers && all.printers[name]) || (config.printers && config.printers[name]);
    if (!profile) {
      throw new Error(`Printer profile '${name}' tidak ditemukan di konfigurasi`);
    }
    mode = profile.mode;
    target = resolveTarget(profile.target);
  }

  let selectedInterface;
  if (mode === "lan") {
    selectedInterface = `tcp://${target.address}:${target.port}`;
  } else if (isWindows) {
    let winTarget = String(target || "");
    if (winTarget.startsWith("/dev/") || !winTarget) {
      winTarget = printerName || all.defaultPrinter || config.defaultPrinter || "EPSON TM-T82";
    }
    selectedInterface = new WindowsSpoolerInterface(winTarget);
  } else if (mode === "usb" || mode === "bluetooth") {
    selectedInterface = target;
  } else if (mode === "cups" || mode === "printer") {
    selectedInterface = `printer:${target}`;
  } else {
    throw new Error(`Mode printer '${mode}' tidak dikenali (pakai: usb, bluetooth, lan, cups, printer)`);
  }

  let typeKey = "EPSON";
  if (connection && connection.type) {
    typeKey = String(connection.type).toUpperCase();
  } else {
    const name = printerName || all.defaultPrinter || config.defaultPrinter;
    const profile = (all.printers && all.printers[name]) || (config.printers && config.printers[name]);
    if (profile && profile.type) {
      typeKey = String(profile.type).toUpperCase();
    }
  }
  const selectedType = PrinterTypes[typeKey] || PrinterTypes.EPSON;

  const instance = new ThermalPrinter({
    type: selectedType,
    interface: selectedInterface,
    width: config.charsPerLine || 48,
    removeSpecialCharacters: false,
    options: { timeout: 5000 },
  });

  // Bungkus instance.execute() ke dalam antrean FIFO print-queue
  const queueKey = typeof target === "object" ? `${target.address}:${target.port}` : String(target || printerName || "default");
  const origExecute = instance.execute.bind(instance);

  instance.execute = function (...args) {
    logger.info("ThermalPrinter", `Memasukkan job thermal print ke antrean '${queueKey}'`);
    return enqueuePrint(queueKey, async () => {
      try {
        const result = await origExecute(...args);
        logger.info("ThermalPrinter", `Eksekusi job thermal '${queueKey}' selesai`);
        return result;
      } catch (err) {
        logger.error("ThermalPrinter", `Gagal mengeksekusi job thermal '${queueKey}'`, err);
        throw err;
      }
    });
  };

  return instance;
}

module.exports = { buildPrinter };
