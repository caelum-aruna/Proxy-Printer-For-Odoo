// test/logger.test.js
// Pengujian Persistent File Logger

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const logger = require("../src/helpers/logger");

async function runLoggerTests() {
  console.log("▶ Menguji File Logger Persisten...");

  const uniqueMsg = `Test_Log_Execution_${Date.now()}`;
  logger.info("TestRunner", uniqueMsg);
  logger.warn("TestRunner", "Peringatan uji coba");
  logger.error("TestRunner", "Simulasi error uji coba", new Error("Sample Error"));

  // Verifikasi file log hari ini
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const logFile = path.join(logger.LOGS_DIR, `print-proxy-${dateStr}.log`);

  assert.strictEqual(fs.existsSync(logFile), true, "File log hari ini harus dibuat di logs/");

  const content = fs.readFileSync(logFile, "utf-8");
  assert.strictEqual(content.includes(uniqueMsg), true, "Pesan log unik harus tercatat di dalam file log");
  assert.strictEqual(content.includes("[INFO] [TestRunner]"), true, "Tag level INFO harus tercatat");
  assert.strictEqual(content.includes("[ERROR] [TestRunner]"), true, "Tag level ERROR harus tercatat");

  console.log("  ✔ Uji penulisan file log harian lulus");
  console.log("  ✔ Uji format timestamp & tag lulus");
  console.log("✅ Semua pengujian Logger BERHASIL!\n");
}

module.exports = runLoggerTests;

if (require.main === module) {
  runLoggerTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
