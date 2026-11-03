// src/helpers/cert-manager.js
// Mengelola dan menghasilkan sertifikat SSL/TLS (Self-Signed) otomatis
// Dilengkapi Subject Alternative Name (SAN) untuk IP lokal dan localhost
// agar Print Proxy bisa melayani HTTPS untuk Odoo Production IoT Box tanpa penolakan SAN.

const fs = require("fs");
const path = require("path");
const tls = require("tls");
const os = require("os");
const crypto = require("crypto");
const { execSync } = require("child_process");

const CERTS_DIR = path.join(__dirname, "../../certs");
const KEY_FILE = path.join(CERTS_DIR, "server.key");
const CERT_FILE = path.join(CERTS_DIR, "server.crt");

let cachedSecureContext = null;

/**
 * Dapatkan semua alamat IPv4 lokal di komputer ini untuk dimasukkan ke SAN sertifikat.
 * @returns {string[]}
 */
function getLocalIps() {
  const ips = ["127.0.0.1"];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const netInfo of ifaces[name]) {
      if (netInfo.family === "IPv4" && !netInfo.internal) {
        ips.push(netInfo.address);
      }
    }
  }
  return [...new Set(ips)];
}

/**
 * Cek apakah file sertifikat yang ada saat ini sudah memiliki ekstensi SAN.
 */
function certHasSubjectAltName(certPath) {
  try {
    if (!fs.existsSync(certPath)) return false;
    const certBuf = fs.readFileSync(certPath);
    if (crypto.X509Certificate) {
      const x509 = new crypto.X509Certificate(certBuf);
      return Boolean(x509.subjectAltName && x509.subjectAltName.length > 0);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Pastikan sertifikat SSL tersedia di komputer lokal dengan SAN yang valid.
 */
async function ensureCertificate(forceRegenerate = false) {
  if (!fs.existsSync(CERTS_DIR)) {
    fs.mkdirSync(CERTS_DIR, { recursive: true });
  }

  const localIps = getLocalIps();

  // Jika sertifikat sudah ada dan tidak dipaksa buat baru, cek apakah sudah ada SAN
  if (!forceRegenerate && fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
    if (certHasSubjectAltName(CERT_FILE)) {
      return { keyPath: KEY_FILE, certPath: CERT_FILE, localIps };
    }
  }

  console.log("[SSL] Membuat sertifikat SSL self-signed baru dengan SAN untuk HTTPS Odoo IoT Box...");
  console.log(`[SSL] Mendaftarkan SAN: localhost, ${localIps.join(", ")}`);

  // 1. Coba buat dengan OpenSSL CLI jika tersedia
  try {
    const sanList = ["DNS:localhost", ...localIps.map((ip) => `IP:${ip}`)].join(",");
    const cmd = `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_FILE}" -out "${CERT_FILE}" -days 3650 -nodes -subj "/CN=Odoo-Print-Proxy/O=Technoindo" -addext "subjectAltName=${sanList}"`;
    execSync(cmd, { stdio: "pipe" });
    console.log("[SSL] Sertifikat SSL (dengan SAN) berhasil dibuat menggunakan OpenSSL.");
    cachedSecureContext = null;
    return { keyPath: KEY_FILE, certPath: CERT_FILE, localIps };
  } catch (err) {
    // 2. Fallback: Di Windows tanpa OpenSSL, gunakan modul selfsigned murni JS
    try {
      const selfsigned = require("selfsigned");
      const altNames = [
        { type: 2, value: "localhost" },
        ...localIps.map((ip) => ({ type: 7, ip: ip })),
      ];

      const pems = await selfsigned.generate(
        [
          { name: "commonName", value: "Odoo Print Proxy" },
          { name: "organizationName", value: "Technoindo" },
        ],
        {
          days: 3650,
          keySize: 2048,
          algorithm: "sha256",
          extensions: [
            {
              name: "subjectAltName",
              altNames: altNames,
            },
          ],
        }
      );
      fs.writeFileSync(KEY_FILE, pems.private, "utf-8");
      fs.writeFileSync(CERT_FILE, pems.cert, "utf-8");
      console.log("[SSL] Sertifikat SSL (dengan SAN) berhasil dibuat otomatis dengan library selfsigned.");
      cachedSecureContext = null;
      return { keyPath: KEY_FILE, certPath: CERT_FILE, localIps };
    } catch (fallbackErr) {
      console.error("[SSL] Gagal membuat sertifikat SSL:", fallbackErr.message);
      throw fallbackErr;
    }
  }
}

function getSecureContext() {
  if (cachedSecureContext) return cachedSecureContext;

  if (!fs.existsSync(KEY_FILE) || !fs.existsSync(CERT_FILE)) {
    throw new Error("[SSL] Sertifikat belum diinisialisasi. Panggil ensureCertificate() saat startup.");
  }

  const key = fs.readFileSync(KEY_FILE);
  const cert = fs.readFileSync(CERT_FILE);

  cachedSecureContext = tls.createSecureContext({ key, cert });
  return cachedSecureContext;
}

module.exports = {
  ensureCertificate,
  getSecureContext,
  getLocalIps,
  KEY_FILE,
  CERT_FILE,
};
