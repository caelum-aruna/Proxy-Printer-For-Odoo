// server.js
// Entry point — bootstrap dan start server dengan dynamic port manager

const app = require("./src/app");
const config = require("./config");
const { startAllConfiguredPorts, getAllPrinters } = require("./src/helpers/config-manager");
const { ensureCertificate } = require("./src/helpers/cert-manager");
const { createDualServer } = require("./src/helpers/dual-server");

async function bootstrap() {
  // Pastikan sertifikat SSL siap (dibuat otomatis jika belum ada)
  await ensureCertificate();

  // 1. Port utama (Web Dashboard & Default Printer) — melayani HTTP dan HTTPS di semua network interface (0.0.0.0)
  const mainServer = createDualServer(app);

  mainServer.listen(config.serverPort, "0.0.0.0", () => {
    const data = getAllPrinters();
    const printerNames = Object.keys(data.printers);

    console.log(`Print proxy dashboard jalan di:`);
    console.log(`- HTTP : http://localhost:${config.serverPort}`);
    console.log(`- HTTPS: https://localhost:${config.serverPort}`);

    if (printerNames.length === 0) {
      console.log(`Belum ada printer terdaftar.`);
      console.log(`Silakan buka dashboard di browser untuk menambahkan printer kasir / dotmatrix.`);
    } else {
      console.log(`Printer terdaftar: ${printerNames.join(", ")}`);
      console.log(`Default Printer: ${data.defaultPrinter || "(belum dipilih)"}`);
    }

    // 2. Buka semua port dedicated yang tersimpan untuk masing-masing kasir
    startAllConfiguredPorts(app);
  });
}

bootstrap().catch((err) => {
  console.error("Gagal memulai server:", err);
  process.exit(1);
});
