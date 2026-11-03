// src/helpers/logger.js
// Logger persisten ke file harian di logs/print-proxy-YYYY-MM-DD.log
// Tanpa dependensi pihak ketiga, dilengkapi pembersihan log lama otomatis (retensi 14 hari).

const fs = require("fs");
const path = require("path");

const LOGS_DIR = path.join(__dirname, "../../logs");
const RETENTION_DAYS = 14;

// Pastikan direktori logs tersedia
if (!fs.existsSync(LOGS_DIR)) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  } catch (e) {
    console.error("[Logger] Gagal membuat direktori logs:", e.message);
  }
}

/**
 * Format timestamp ISO lokal (YYYY-MM-DD HH:mm:ss.SSS)
 */
function getTimestamp() {
  const d = new Date();
  const pad = (n, s = 2) => String(n).padStart(s, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const ms = pad(d.getMilliseconds(), 3);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Dapatkan path file log hari ini
 */
function getTodayLogPath() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return path.join(LOGS_DIR, `print-proxy-${dateStr}.log`);
}

/**
 * Tulis baris ke file log hari ini secara append
 */
function appendToFile(line) {
  try {
    const filePath = getTodayLogPath();
    fs.appendFileSync(filePath, line + "\n", "utf-8");
  } catch (err) {
    // Jangan biarkan kegagalan logging menghentikan aplikasi
    console.error("[Logger] Gagal menulis ke file log:", err.message);
  }
}

/**
 * Log informasi umum
 * @param {string} tag
 * @param {string} message
 */
function info(tag, message) {
  const line = `[${getTimestamp()}] [INFO] [${tag}] ${message}`;
  console.log(line);
  appendToFile(line);
}

/**
 * Log peringatan
 * @param {string} tag
 * @param {string} message
 */
function warn(tag, message) {
  const line = `[${getTimestamp()}] [WARN] [${tag}] ${message}`;
  console.warn(line);
  appendToFile(line);
}

/**
 * Log error dengan stack trace
 * @param {string} tag
 * @param {string} message
 * @param {Error|any} [err]
 */
function error(tag, message, err) {
  let line = `[${getTimestamp()}] [ERROR] [${tag}] ${message}`;
  if (err && err.message) {
    line += ` - Error: ${err.message}`;
  }
  if (err && err.stack) {
    line += `\n${err.stack}`;
  }
  console.error(line);
  appendToFile(line);
}

/**
 * Pembersihan otomatis berkas log yang berusia lebih dari RETENTION_DAYS
 */
function cleanOldLogs() {
  if (!fs.existsSync(LOGS_DIR)) return;
  try {
    const files = fs.readdirSync(LOGS_DIR);
    const now = Date.now();
    const maxAgeMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

    files.forEach((file) => {
      if (file.startsWith("print-proxy-") && file.endsWith(".log")) {
        const fullPath = path.join(LOGS_DIR, file);
        try {
          const stats = fs.statSync(fullPath);
          if (now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(fullPath);
            info("Logger", `Log lama dihapus: ${file}`);
          }
        } catch (e) {
          // ignore
        }
      }
    });
  } catch (e) {
    console.warn("[Logger] Gagal memeriksa log lama:", e.message);
  }
}

/**
 * Express middleware untuk mencatat request HTTP & durasi respons
 */
function requestLoggerMiddleware() {
  return (req, res, next) => {
    // Jangan log polling static assets yang terlalu sering
    if (req.path.startsWith("/assets") || req.path === "/favicon.ico") {
      return next();
    }

    const start = Date.now();
    const clientIp = (req.ip || req.connection.remoteAddress || "").replace(/^.*:/, "");

    res.on("finish", () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const msg = `${req.method} ${req.originalUrl || req.url} - Status: ${status} - IP: ${clientIp} - ${duration}ms`;

      if (status >= 500) {
        error("HTTP", msg);
      } else if (status >= 400) {
        warn("HTTP", msg);
      } else {
        info("HTTP", msg);
      }
    });

    next();
  };
}

// Jalankan pembersihan saat inisialisasi modul
cleanOldLogs();

module.exports = {
  info,
  warn,
  error,
  cleanOldLogs,
  requestLoggerMiddleware,
  LOGS_DIR,
};
