// src/helpers/auto-detect.js
// Deteksi printer otomatis untuk USB, Serial/Bluetooth, dan LAN (Port 9100)
// Mendukung Windows, Linux, dan macOS

const fs = require("fs");
const net = require("net");
const os = require("os");
const { exec } = require("child_process");

/**
 * Deteksi printer USB dan Serial yang tercolok di sistem operasi lokal.
 * @returns {Promise<Array>} Daftar printer USB/lokal yang ditemukan
 */
function detectUsbPrinters() {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const found = [];

    if (isWindows) {
      // Di Windows: gunakan PowerShell untuk query Win32_Printer
      const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name,PortName,DriverName,ShareName,Shared | ConvertTo-Json"`;
      exec(psCmd, { timeout: 5000 }, (err, stdout) => {
        if (!err && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout.trim());
            const printers = Array.isArray(parsed) ? parsed : [parsed];
            printers.forEach((p) => {
              if (!p || !p.Name) return;
              const port = String(p.PortName || "").toUpperCase();
              let mode = "printer";
              if (port.startsWith("COM")) mode = "bluetooth";

              const combinedInfo = `${p.DriverName || ""} ${p.Name || ""}`.toLowerCase();
              const isRegularDoc = /series|ink|canon|deskjet|laserjet|pdf|xps|l220|l3210/.test(combinedInfo);
              if (isRegularDoc && !/pos|thermal|receipt|lx-|lq-|matrix/.test(combinedInfo)) {
                mode = "standard";
              }

              // Di Windows: target langsung berupa nama printer yang terdaftar di Windows
              // (misal: 'EPSON LQ-310 ESC/P2' atau 'POS-80') untuk dikirim ke Win32 Spooler
              const target = port.startsWith("COM") ? p.PortName : p.Name;

              found.push({
                name: p.Name,
                mode: mode,
                target: target,
                portName: p.PortName,
                driverName: p.DriverName,
                isShared: Boolean(p.Shared),
                os: "win32",
                deviceType: "windows_spooler",
                recommendedConfig: {
                  mode: mode,
                  target: target,
                },
              });
            });
          } catch (e) {
            console.warn("[AutoDetect] Gagal parse output PowerShell:", e.message);
          }
        }
        resolve(found);
      });
    } else {
      // Di Linux / Unix:
      // 1. Cek device file /dev/usb/lp*
      if (fs.existsSync("/dev/usb")) {
        try {
          const files = fs.readdirSync("/dev/usb");
          files.filter((f) => f.startsWith("lp")).forEach((lp) => {
            const devPath = `/dev/usb/${lp}`;
            found.push({
              name: `USB Printer (${lp})`,
              mode: "usb",
              target: devPath,
              os: "linux",
              deviceType: "linux_usb_direct",
              recommendedConfig: { mode: "usb", target: devPath },
            });
          });
        } catch (e) {
          // ignore permission error
        }
      }

      // 2. Cek device file /dev/lp* (parallel / standard printer port)
      try {
        const devFiles = fs.readdirSync("/dev");
        devFiles.filter((f) => /^lp\d+$/.test(f)).forEach((lp) => {
          const devPath = `/dev/${lp}`;
          found.push({
            name: `Parallel/Legacy Printer (${lp})`,
            mode: "usb",
            target: devPath,
            os: "linux",
            deviceType: "linux_lp",
            recommendedConfig: { mode: "usb", target: devPath },
          });
        });

        // 3. Cek serial / rfcomm bluetooth
        devFiles.filter((f) => f.startsWith("rfcomm") || f.startsWith("ttyUSB")).forEach((port) => {
          const devPath = `/dev/${port}`;
          found.push({
            name: `Serial/Bluetooth (${port})`,
            mode: "bluetooth",
            target: devPath,
            os: "linux",
            deviceType: "serial_bluetooth",
            recommendedConfig: { mode: "bluetooth", target: devPath },
          });
        });
      } catch (e) {
        // ignore
      }

      // 4. Cek daftar printer CUPS
      exec("lpstat -p -d", { timeout: 3000 }, (err, stdout) => {
        if (!err && stdout) {
          const lines = stdout.split("\n");
          lines.forEach((line) => {
            const match = line.match(/^printer\s+([^\s]+)/i);
            if (match) {
              const printerName = match[1];
              // Tambahkan jika belum ada di list
              if (!found.some((f) => f.target === printerName)) {
                found.push({
                  name: `CUPS: ${printerName}`,
                  mode: "cups",
                  target: printerName,
                  os: "linux",
                  deviceType: "cups_spooler",
                  recommendedConfig: { mode: "cups", target: printerName },
                });
              }
            }
          });
        }
        resolve(found);
      });
    }
  });
}

/**
 * Tes koneksi TCP port (biasanya 9100 untuk raw ESC/POS).
 */
function testTcpPort(ip, port, timeoutMs = 350) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, ip);
  });
}

/**
 * Dapatkan daftar subnet IPv4 lokal (misal: "192.168.1").
 */
function getLocalSubnets() {
  const subnets = new Set();
  const ifaces = os.networkInterfaces();

  for (const name of Object.keys(ifaces)) {
    for (const netInfo of ifaces[name]) {
      if (netInfo.family === "IPv4" && !netInfo.internal) {
        const parts = netInfo.address.split(".");
        if (parts.length === 4) {
          subnets.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
        }
      }
    }
  }
  return Array.from(subnets);
}

/**
 * Scan printer LAN di subnet lokal pada port 9100 (ESC/POS).
 * @param {{ subnet?: string, start?: number, end?: number, port?: number }} opts
 * @returns {Promise<Array>} Daftar printer LAN yang ditemukan
 */
async function detectLanPrinters(opts = {}) {
  const port = opts.port || 9100;
  const start = opts.start || 1;
  const end = Math.min(opts.end || 254, 254);
  const targetSubnets = opts.subnet ? [opts.subnet] : getLocalSubnets();

  const foundPrinters = [];

  for (const subnet of targetSubnets) {
    const ipList = [];
    for (let i = start; i <= end; i++) {
      ipList.push(`${subnet}.${i}`);
    }

    // Scan secara parallel per batch 40 IP sekaligus agar cepat (total scan < 2 detik)
    const batchSize = 40;
    for (let i = 0; i < ipList.length; i += batchSize) {
      const batch = ipList.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (ip) => {
          const isOpen = await testTcpPort(ip, port, 300);
          return isOpen ? ip : null;
        })
      );

      for (const openIp of results) {
        if (openIp) {
          foundPrinters.push({
            name: `LAN Printer (${openIp}:${port})`,
            mode: "lan",
            target: { address: openIp, port: port },
            deviceType: "network_escpos",
            recommendedConfig: {
              mode: "lan",
              target: { address: openIp, port: port },
            },
          });
        }
      }
    }
  }

  return foundPrinters;
}

/**
 * Deteksi semua printer (USB + opsi scan LAN).
 */
async function detectAllPrinters(options = {}) {
  const scanLan = options.scanLan === true || options.scanLan === "true";
  const [usbPrinters, lanPrinters] = await Promise.all([
    detectUsbPrinters(),
    scanLan ? detectLanPrinters(options) : Promise.resolve([]),
  ]);

  return {
    os: process.platform,
    timestamp: new Date().toISOString(),
    scanLanEnabled: scanLan,
    usb: usbPrinters,
    lan: lanPrinters,
    all: [...usbPrinters, ...lanPrinters],
    totalFound: usbPrinters.length + lanPrinters.length,
  };
}

module.exports = {
  detectUsbPrinters,
  detectLanPrinters,
  detectAllPrinters,
};
