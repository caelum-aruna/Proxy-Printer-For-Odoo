// src/helpers/raw-printer.js
// Kirim data mentah (binary/teks) langsung ke printer via file descriptor, TCP socket, atau Windows Spooler
// Dilengkapi antrean sequential (FIFO queue) dan file logger terintegrasi.

const fs = require("fs");
const net = require("net");
const { exec } = require("child_process");
const config = require("../../config");
const { getAllPrinters } = require("./config-manager");
const { printRawWindows } = require("./windows-spooler");
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
 * Eksekusi fisik pengiriman data mentah (dipanggil melalui antrean sequential).
 */
function doPrintRawData(opts) {
  const { printerName, connection, data, mode: printModeOverride } = opts;
  return new Promise((resolve, reject) => {
    let mode, target, profile;
    const dynamicConfig = getAllPrinters();
    const allPrinters = { ...config.printers, ...(dynamicConfig.printers || {}) };

    if (connection) {
      mode = connection.mode;
      target = resolveTarget(connection.target);
    } else {
      const name = printerName || (allPrinters.dotmatrix ? "dotmatrix" : (dynamicConfig.defaultPrinter || config.defaultPrinter));
      profile = allPrinters[name];
      if (!profile) {
        return reject(new Error(`Printer profile '${name}' tidak ditemukan di konfigurasi`));
      }
      mode = profile.mode;
      target = resolveTarget(profile.target);
    }

    if (!data) {
      return reject(new Error("Data cetak (data) kosong"));
    }

    const targetKey = typeof target === "object" ? `${target.address}:${target.port}` : String(target);
    logger.info("RawPrinter", `Memulai job raw print ke '${targetKey}' [mode: ${mode}]`);

    // 1. KONEKSI NETWORK / LAN (Port 9100) — Cross-Platform (Windows & Linux)
    if (mode === "lan") {
      const client = new net.Socket();
      client.setTimeout(5000);
      client.connect(target.port || 9100, target.address, () => {
        client.write(data, "binary", () => {
          client.end();
          logger.info("RawPrinter", `Berhasil mengirim raw print ke LAN ${target.address}:${target.port}`);
          resolve();
        });
      });
      client.on("error", (err) => {
        logger.error("RawPrinter", `Koneksi LAN error di ${target.address}:${target.port}`, err);
        reject(err);
      });
      client.on("timeout", () => {
        client.destroy();
        const timeoutErr = new Error(`Timeout koneksi printer LAN di ${target.address}:${target.port}`);
        logger.error("RawPrinter", timeoutErr.message);
        reject(timeoutErr);
      });
      return;
    }

    // 2. SISTEM OPERASI WINDOWS (Native Spooler / Win32 API & Text Engine)
    if (isWindows) {
      let winPrinterName = String(target || "");
      if (winPrinterName.startsWith("/dev/") || !winPrinterName) {
        winPrinterName = (printerName && printerName !== "dotmatrix") ? printerName : "EPSON LQ-310 ESC/P2";
        logger.warn("RawPrinter", `Target Windows tidak valid ('${target}'), diarahkan ke: '${winPrinterName}'`);
      }

      // Tentukan mode: jika opsi eksplisit diberikan pakai itu, jika mode standard/gdi gunakan text, selainnya auto
      const winMode = printModeOverride || (profile && (profile.mode === "standard" || profile.mode === "gdi") ? "text" : "auto");

      printRawWindows({ printerName: winPrinterName, data, mode: winMode })
        .then(() => {
          logger.info("RawPrinter", `Berhasil mengirim job ke Windows Spooler '${winPrinterName}' [mode: ${winMode}]`);
          resolve();
        })
        .catch((err) => {
          logger.error("RawPrinter", `Gagal mengirim ke Windows Spooler '${winPrinterName}'`, err);
          reject(err);
        });
      return;
    }

    // 3. SISTEM OPERASI LINUX / MAC
    if (mode === "usb" || mode === "bluetooth") {
      fs.writeFile(target, Buffer.from(data, "binary"), (err) => {
        if (err) {
          logger.error("RawPrinter", `Gagal menulis ke device file '${target}'`, err);
          return reject(err);
        }
        logger.info("RawPrinter", `Berhasil menulis ke device file '${target}'`);
        resolve();
      });
    } else if (mode === "cups" || mode === "printer" || mode === "standard") {
      const child = exec(`lpr -P "${target}" -o raw`, (err, stdout, stderr) => {
        if (err) {
          const errMsg = stderr || err.message;
          logger.error("RawPrinter", `CUPS lpr error '${target}'`, new Error(errMsg));
          return reject(new Error(errMsg));
        }
        logger.info("RawPrinter", `Berhasil mengirim via CUPS lpr ke '${target}'`);
        resolve();
      });
      child.stdin.write(data, "binary");
      child.stdin.end();
    } else {
      const err = new Error(`Mode printer '${mode}' tidak didukung untuk raw print di OS ${process.platform}`);
      logger.error("RawPrinter", err.message);
      reject(err);
    }
  });
}

/**
 * Cetak data mentah ke printer (dot matrix, ESC/P, dll) melalui antrean sequential.
 * @param {{ printerName?: string, connection?: object, data: string|Buffer, mode?: string }} opts
 * @returns {Promise<void>}
 */
function printRawData(opts) {
  const dynamicConfig = getAllPrinters();
  const allPrinters = { ...config.printers, ...(dynamicConfig.printers || {}) };
  const target = (opts.connection && opts.connection.target) ||
                 (allPrinters[opts.printerName] && allPrinters[opts.printerName].target) ||
                 opts.printerName ||
                 "default";

  const targetKey = typeof target === "object" ? `${target.address}:${target.port}` : String(target);

  // Masukkan ke antrean FIFO agar tidak tabrakan
  return enqueuePrint(targetKey, () => doPrintRawData(opts));
}

module.exports = { printRawData };
