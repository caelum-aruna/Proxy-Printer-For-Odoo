// test/run-all.js
// Test Runner Utama untuk Odoo Print Proxy

const runQueueTests = require("./queue.test");
const runLoggerTests = require("./logger.test");
const runEndpointTests = require("./endpoints.test");

async function runAll() {
  console.log("=================================================");
  console.log("   MEMULAI AUTOMATED TEST SUITE: PRINT PROXY    ");
  console.log("=================================================\n");

  const start = Date.now();

  try {
    await runQueueTests();
    await runLoggerTests();
    await runEndpointTests();

    const elapsed = Date.now() - start;
    console.log("=================================================");
    console.log(`🎉 SELURUH PENGUJIAN LULUS DENGAN SUKSES! (${elapsed}ms)`);
    console.log("=================================================");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ TEST GAGAL DENGAN ERROR:", err);
    process.exit(1);
  }
}

runAll();
