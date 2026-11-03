// test/endpoints.test.js
// Pengujian Integrasi Endpoint HTTP Express

const assert = require("assert");
const app = require("../src/app");

async function runEndpointTests() {
  console.log("▶ Menguji Endpoint HTTP Express...");

  const server = app.listen(9999);

  try {
    // 1. Uji GET /system-info
    const resInfo = await fetch("http://localhost:9999/system-info");
    const jsonInfo = await resInfo.json();
    assert.strictEqual(jsonInfo.status, "online");
    assert.strictEqual(typeof jsonInfo.queue, "object");
    console.log("  ✔ Uji GET /system-info lulus (Status: online, Queue status terdeteksi)");

    // 2. Uji GET /logs
    const resLogs = await fetch("http://localhost:9999/logs");
    const jsonLogs = await resLogs.json();
    assert.strictEqual(Array.isArray(jsonLogs.lines), true);
    console.log(`  ✔ Uji GET /logs lulus (${jsonLogs.lines.length} baris log berhasil dimuat)`);

    // 3. Uji POST /dotmatrix/print validasi payload kosong
    const resDm = await fetch("http://localhost:9999/dotmatrix/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const jsonDm = await resDm.json();
    assert.strictEqual(jsonDm.status, "ERROR");
    console.log("  ✔ Uji POST /dotmatrix/print validasi input kosong lulus");

    // 4. Uji POST /hw_proxy/status_json
    const resHw = await fetch("http://localhost:9999/hw_proxy/status_json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1 }),
    });
    const jsonHw = await resHw.json();
    assert.strictEqual(jsonHw.result.status, "connected");
    console.log("  ✔ Uji POST /hw_proxy/status_json emulator Odoo lulus");

    // 5. Uji CORS Preflight (OPTIONS) dengan header x-debug-mode & Private Network Access (PNA)
    const resCors = await fetch("http://localhost:9999/hw_proxy/handshake", {
      method: "OPTIONS",
      headers: {
        Origin: "https://karyajayasantosa.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type, x-debug-mode",
        "Access-Control-Request-Private-Network": "true",
      },
    });
    assert.strictEqual(resCors.status, 200);
    assert.strictEqual(resCors.headers.get("access-control-allow-origin"), "https://karyajayasantosa.com");
    assert.strictEqual(resCors.headers.get("access-control-allow-private-network"), "true");
    assert.strictEqual(resCors.headers.get("access-control-allow-credentials"), "true");
    assert.strictEqual(resCors.headers.get("access-control-allow-headers"), "content-type, x-debug-mode");
    console.log("  ✔ Uji CORS Preflight & x-debug-mode lulus (Status: 200 OK)");

    // 5b. Uji GET/POST /hw_proxy/handshake
    const resHandshake = await fetch("http://localhost:9999/hw_proxy/handshake?session_id=12345");
    const jsonHandshake = await resHandshake.json();
    assert.strictEqual(jsonHandshake.result, true);
    console.log("  ✔ Uji /hw_proxy/handshake lulus (result: true)");

    // 6. Uji Favicon 204 (tanpa 404)
    const resFav = await fetch("http://localhost:9999/favicon.ico");
    assert.strictEqual(resFav.status, 204);
    console.log("  ✔ Uji GET /favicon.ico lulus (Status: 204 No Content)");

    // 7. Uji Unduh Sertifikat SSL /server.crt
    const resCert = await fetch("http://localhost:9999/server.crt");
    assert.strictEqual(resCert.status, 200);
    console.log("  ✔ Uji GET /server.crt lulus (Status: 200 OK)");

    // 8. Uji Endpoint Odoo Modern /hw_drivers/check_certificate
    const resHwDrv = await fetch("http://localhost:9999/hw_drivers/check_certificate");
    const jsonHwDrv = await resHwDrv.json();
    assert.strictEqual(jsonHwDrv.status, "ok");
    console.log("  ✔ Uji GET /hw_drivers/check_certificate lulus (Status: ok)");

    // 9. Uji POST /printers/clear-queue
    const resClr = await fetch("http://localhost:9999/printers/clear-queue", { method: "POST" });
    const jsonClr = await resClr.json();
    assert.strictEqual(jsonClr.success, true);
    console.log("  ✔ Uji POST /printers/clear-queue lulus");

    // 10. Uji POST /hw_drivers/action (Odoo Modern IoT Box)
    const resActionMissing = await fetch("http://localhost:9999/hw_drivers/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, params: { action: "print_receipt" } }),
    });
    const jsonActionMissing = await resActionMissing.json();
    assert.strictEqual(resActionMissing.status, 400);
    assert.ok(jsonActionMissing.error);
    console.log("  ✔ Uji POST /hw_drivers/action validasi data kosong lulus");

    // 10b. Uji POST /hw_drivers/action dengan generic action
    const resActionGeneric = await fetch("http://localhost:9999/hw_drivers/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, params: { action: "status" } }),
    });
    const jsonActionGeneric = await resActionGeneric.json();
    assert.strictEqual(jsonActionGeneric.result, true);
    console.log("  ✔ Uji POST /hw_drivers/action generic action lulus");

    // 11. Uji POST /hw_proxy/print_xml_receipt validasi data kosong
    const resXmlMissing = await fetch("http://localhost:9999/hw_proxy/print_xml_receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 4, params: {} }),
    });
    assert.strictEqual(resXmlMissing.status, 400);
    console.log("  ✔ Uji POST /hw_proxy/print_xml_receipt validasi payload kosong lulus");

    console.log("✅ Semua pengujian Endpoint BERHASIL!\n");
  } finally {
    server.close();
  }
}

module.exports = runEndpointTests;

if (require.main === module) {
  runEndpointTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
