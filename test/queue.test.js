// test/queue.test.js
// Pengujian In-Memory Sequential Print Queue (FIFO)

const assert = require("assert");
const { enqueuePrint, getQueueStatus } = require("../src/helpers/print-queue");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runQueueTests() {
  console.log("▶ Menguji In-Memory Print Queue...");

  // 1. Uji eksekusi berurutan (sequential) untuk printer yang sama
  const order = [];
  const p1 = enqueuePrint("kasir1", async () => {
    await sleep(50);
    order.push(1);
    return "job1";
  });

  const p2 = enqueuePrint("kasir1", async () => {
    await sleep(20);
    order.push(2);
    return "job2";
  });

  const p3 = enqueuePrint("kasir1", async () => {
    order.push(3);
    return "job3";
  });

  const results = await Promise.all([p1, p2, p3]);

  assert.deepStrictEqual(order, [1, 2, 3], "Job tidak dieksekusi secara sequential FIFO!");
  assert.deepStrictEqual(results, ["job1", "job2", "job3"], "Return value job mismatch!");
  console.log("  ✔ Uji sequential FIFO lulus: Job 1, 2, 3 dieksekusi tertib");

  // 2. Uji ketahanan antrean saat salah satu job gagal (error recovery)
  let jobAfterErrorRan = false;
  const failingJob = enqueuePrint("printer_error_test", async () => {
    throw new Error("Simulasi printer macet/out of paper");
  });

  const nextJob = enqueuePrint("printer_error_test", async () => {
    jobAfterErrorRan = true;
    return "recovered";
  });

  let errorCaught = false;
  try {
    await failingJob;
  } catch (e) {
    errorCaught = true;
  }

  assert.strictEqual(errorCaught, true, "Error job yang gagal harus di-throw ke pemanggil");
  const nextRes = await nextJob;
  assert.strictEqual(jobAfterErrorRan, true, "Job berikutnya harus tetap berjalan meski job sebelumnya error!");
  assert.strictEqual(nextRes, "recovered");
  console.log("  ✔ Uji error recovery lulus: Antrean tidak macet saat job gagal");

  // 3. Uji paralelisme antar printer yang berbeda
  const parallelOrder = [];
  const tA = enqueuePrint("printerA", async () => {
    await sleep(40);
    parallelOrder.push("A");
  });
  const tB = enqueuePrint("printerB", async () => {
    await sleep(10);
    parallelOrder.push("B");
  });

  await Promise.all([tA, tB]);
  assert.deepStrictEqual(parallelOrder, ["B", "A"], "Printer yang berbeda harus berjalan paralel!");
  console.log("  ✔ Uji paralelisme lintas printer lulus");

  console.log("✅ Semua pengujian Queue BERHASIL!\n");
}

module.exports = runQueueTests;

if (require.main === module) {
  runQueueTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
