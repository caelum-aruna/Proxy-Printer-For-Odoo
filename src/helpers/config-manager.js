// src/helpers/config-manager.js
// Pengelola konfigurasi printer dinamis & persisten (disimpan ke printers.json)
// Tidak ada hardcode nama kasir atau port!

const fs = require("fs");
const path = require("path");
const baseConfig = require("../../config");

const DATA_FILE = path.join(__dirname, "../../printers.json");
const isWindows = process.platform === "win32";

// Server listener registry untuk multi-port dinamis
const activeServers = new Map();
let expressAppInstance = null;

function setAppInstance(app) {
  expressAppInstance = app;
}

/**
 * Muat data printer dari printers.json atau fallback ke config.js
 */
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data = JSON.parse(raw);

      // Jika berjalan di Windows namun printers.json masih menyimpan path Linux (/dev/...),
      // otomatis migrasikan ke konfigurasi default Windows
      if (isWindows && data.printers) {
        let modified = false;
        Object.keys(data.printers).forEach((key) => {
          const p = data.printers[key];
          if (p && typeof p.target === "string" && p.target.startsWith("/dev/")) {
            if (baseConfig.printers && baseConfig.printers[key]) {
              p.target = baseConfig.printers[key].target;
              p.mode = baseConfig.printers[key].mode || "printer";
              modified = true;
            } else if (key.toLowerCase().includes("dotmatrix")) {
              p.target = "EPSON LQ-310 ESC/P2";
              p.mode = "printer";
              modified = true;
            } else {
              p.target = "POS-80";
              p.mode = "printer";
              modified = true;
            }
          }
        });
        if (modified) {
          saveData(data);
        }
      }

      // Pastikan defaultPrinter selalu terisi jika hanya ada satu printer
      if (data && data.printers) {
        const keys = Object.keys(data.printers);
        if (keys.length === 1 && !data.defaultPrinter) {
          data.defaultPrinter = keys[0];
          saveData(data);
        }
      }

      return data;
    } catch (e) {
      console.warn("[ConfigManager] Gagal membaca printers.json, menggunakan default config:", e.message);
    }
  }

  // Jika belum ada file printers.json, buat kosong — user tambahkan printer lewat dashboard
  const initial = {
    serverPort: baseConfig.serverPort || 8000,
    defaultPrinter: baseConfig.defaultPrinter || "",
    charsPerLine: baseConfig.charsPerLine || 33,
    printers: baseConfig.printers || {},
  };

  saveData(initial);
  return initial;
}

/**
 * Simpan data printer ke file printers.json
 */
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("[ConfigManager] Gagal menulis ke printers.json:", e.message);
  }
}

/**
 * Cari port berikutnya yang belum terpakai (mulai dari 8001, 8002, dst.)
 */
function getNextAvailablePort() {
  const data = loadData();
  const usedPorts = new Set();
  usedPorts.add(data.serverPort || 8000);

  Object.values(data.printers || {}).forEach((p) => {
    if (p.port) usedPorts.add(parseInt(p.port, 10));
  });

  let port = 8001;
  while (usedPorts.has(port)) {
    port++;
  }
  return port;
}

/**
 * Pastikan port tertentu sedang aktif mendengarkan request Odoo
 */
function startPortListener(port) {
  const p = parseInt(port, 10);
  if (!p || p <= 0 || p === (baseConfig.serverPort || 8000)) return;
  if (activeServers.has(p)) return; // sudah aktif

  if (expressAppInstance) {
    try {
      const { createDualServer } = require("./dual-server");
      const server = createDualServer(expressAppInstance);
      server.listen(p, "0.0.0.0", () => {
        console.log(`[Multi-Kasir] Port ${p} aktif di 0.0.0.0 (HTTP & HTTPS) dan siap menerima request Odoo.`);
      });
      server.on("error", (err) => {
        console.error(`[Multi-Kasir] Error pada port ${p}:`, err.message);
      });
      activeServers.set(p, server);
    } catch (err) {
      console.error(`[Multi-Kasir] Gagal membuka port ${p}:`, err.message);
    }
  }
}

/**
 * Tutup listener port jika printer dihapus
 */
function stopPortListener(port) {
  const p = parseInt(port, 10);
  if (activeServers.has(p)) {
    const s = activeServers.get(p);
    s.close();
    activeServers.delete(p);
    console.log(`[Multi-Kasir] Port ${p} dinonaktifkan.`);
  }
}

/**
 * Buka semua port printer yang sudah tersimpan saat server start
 */
function startAllConfiguredPorts(app) {
  if (app) setAppInstance(app);
  const data = loadData();
  Object.entries(data.printers || {}).forEach(([name, p]) => {
    if (p.port) {
      startPortListener(p.port);
    }
  });
}

/**
 * Tambah atau update printer
 */
function savePrinter(name, printerData) {
  const data = loadData();
  const cleanName = String(name).trim();

  // Jika port tidak ditentukan, otomatis cari port berikutnya
  let port = printerData.port;
  if (!port && port !== 0) {
    port = getNextAvailablePort();
  } else {
    port = parseInt(port, 10);
  }

  // Jika printer sebelumnya punya port berbeda, stop port lama
  if (data.printers[cleanName] && data.printers[cleanName].port && data.printers[cleanName].port !== port) {
    stopPortListener(data.printers[cleanName].port);
  }

  data.printers[cleanName] = {
    mode: printerData.mode || "usb",
    target: printerData.target,
    port: port,
    type: printerData.type || "epson",
  };

  if (printerData.makeDefault || Object.keys(data.printers).length === 1) {
    data.defaultPrinter = cleanName;
  }

  saveData(data);
  // Sinkronkan ke objek config in-memory
  baseConfig.printers = data.printers;
  baseConfig.defaultPrinter = data.defaultPrinter;

  // Jalankan port listener
  if (port) {
    startPortListener(port);
  }

  return { name: cleanName, ...data.printers[cleanName], isDefault: data.defaultPrinter === cleanName };
}

/**
 * Hapus printer
 */
function deletePrinter(name) {
  const data = loadData();
  const cleanName = String(name).trim();

  if (!data.printers[cleanName]) {
    throw new Error(`Printer '${cleanName}' tidak ditemukan`);
  }

  const port = data.printers[cleanName].port;
  if (port) {
    stopPortListener(port);
  }

  delete data.printers[cleanName];

  // Jika default printer yang dihapus, pindahkan default ke printer pertama yang ada
  if (data.defaultPrinter === cleanName) {
    const keys = Object.keys(data.printers);
    data.defaultPrinter = keys.length > 0 ? keys[0] : "";
  }

  saveData(data);
  baseConfig.printers = data.printers;
  baseConfig.defaultPrinter = data.defaultPrinter;

  return { success: true, remainingCount: Object.keys(data.printers).length };
}

/**
 * Ambil semua printer
 */
function getAllPrinters() {
  const data = loadData();
  // Sinkronkan ke baseConfig
  baseConfig.printers = data.printers;
  baseConfig.defaultPrinter = data.defaultPrinter;
  return data;
}

/**
 * Set default printer
 */
function setDefaultPrinter(name) {
  const data = loadData();
  const cleanName = String(name).trim();
  if (!data.printers[cleanName]) {
    throw new Error(`Printer '${cleanName}' tidak terdaftar`);
  }
  data.defaultPrinter = cleanName;
  saveData(data);
  baseConfig.defaultPrinter = cleanName;
  return cleanName;
}

module.exports = {
  loadData,
  saveData,
  savePrinter,
  deletePrinter,
  getAllPrinters,
  setDefaultPrinter,
  getNextAvailablePort,
  setAppInstance,
  startPortListener,
  stopPortListener,
  startAllConfiguredPorts,
};
