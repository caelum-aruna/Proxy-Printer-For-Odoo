// src/helpers/windows-spooler.js
// Jembatan ke antrian Windows Print Spooler (winspool.drv) & Text Engine (Out-Printer)
// Mendukung Dual-Mode:
// 1. RAW Mode (Win32 API WritePrinter): Untuk Real Dot Matrix (ESC/P) & Thermal (ESC/POS)
// 2. Text Mode (GDI / Out-Printer): Untuk Printer Biasa (Inkjet, Laser, Canon, Epson L-Series, PDF)

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");

const SCRIPT_PATH = path.join(__dirname, "../../scripts/windows-raw-print.ps1");

/**
 * Bersihkan format nama printer jika pengguna tidak sengaja memasukkan format UNC path (\\localhost\NamaPrinter).
 * @param {string} rawName
 * @returns {string}
 */
function cleanPrinterName(rawName) {
  if (!rawName) return "";
  let name = String(rawName).trim();
  // Hapus prefix \\localhost\ atau \\127.0.0.1\ jika ada
  name = name.replace(/^\\\\[^\\]+\\/i, "");
  return name;
}

function cleanErrorMsg(raw) {
  if (!raw) return "";
  const msg = String(raw).trim();
  const lines = msg.split("\n").map((l) => l.trim()).filter(Boolean);
  const relevant = lines.find((l) => l.includes("[WinRawPrint]") || l.includes("[TextPrint]") || l.includes("Win32 Error"));
  return relevant || lines[0] || msg;
}

/**
 * Kirim buffer/data teks atau mentah ke printer Windows melalui Windows Print Spooler atau Text Engine.
 * @param {{ printerName: string, data: string|Buffer, mode?: "auto"|"raw"|"text", docName?: string }} opts
 * @returns {Promise<void>}
 */
function printRawWindows({ printerName, data, mode = "auto", docName = "PRINT_JOB" }) {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32") {
      return reject(new Error("windows-spooler hanya dapat berjalan di sistem operasi Windows"));
    }

    const cleanName = cleanPrinterName(printerName);
    if (!cleanName) {
      return reject(new Error("Nama printer Windows (printerName) tidak boleh kosong"));
    }

    if (!data || (typeof data === "string" && data.length === 0) || (Buffer.isBuffer(data) && data.length === 0)) {
      return reject(new Error("Data cetak (data) kosong"));
    }

    // Buat file temporary di folder %TEMP% Windows
    const randomId = crypto.randomBytes(6).toString("hex");
    const tempFile = path.join(os.tmpdir(), `print_job_${Date.now()}_${randomId}.bin`);
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, "binary");

    try {
      fs.writeFileSync(tempFile, buffer);
    } catch (writeErr) {
      return reject(new Error(`Gagal menulis temporary print file: ${writeErr.message}`));
    }

    const psArgs = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      SCRIPT_PATH,
      "-PrinterName",
      cleanName,
      "-FilePath",
      tempFile,
      "-Mode",
      mode || "auto",
    ];

    execFile("powershell", psArgs, { timeout: 15000 }, (err, stdout, stderr) => {
      // Selalu hapus file temporary setelah perintah selesai
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (e) {
        // Abaikan kegagalan pembersihan temp
      }

      if (err) {
        const rawErr = (stderr || stdout || err.message).trim();
        const errMsg = cleanErrorMsg(rawErr);
        return reject(new Error(`Gagal cetak via Windows Spooler ke '${cleanName}': ${errMsg}`));
      }

      resolve();
    });
  });
}

/**
 * Custom ThermalPrinter Interface adapter untuk node-thermal-printer di Windows.
 * Memungkinkan node-thermal-printer mencetak langsung via Win32 Spooler tanpa driver C++.
 */
class WindowsSpoolerInterface {
  constructor(printerName) {
    this.printerName = cleanPrinterName(printerName);
  }

  getPrinterName() {
    return this.printerName;
  }

  async isPrinterConnected() {
    return true;
  }

  async execute(buffer) {
    return printRawWindows({ printerName: this.printerName, data: buffer, mode: "raw" });
  }
}

module.exports = {
  cleanPrinterName,
  printRawWindows,
  WindowsSpoolerInterface,
};
