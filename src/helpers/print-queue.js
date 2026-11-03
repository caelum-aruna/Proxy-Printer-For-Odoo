// src/helpers/print-queue.js
// Antrean cetak sequential (FIFO) per target printer fisik
// Mencegah dua request cetak mengakses antrian printer spooler pada waktu yang sama

const queues = new Map();
const queueCounts = new Map();

/**
 * Masukkan task cetak ke dalam antrean printer tertentu.
 * Task berikutnya hanya akan berjalan setelah task sebelumnya selesai (resolve atau reject).
 * @param {string} printerKey Nama printer atau target
 * @param {() => Promise<any>} taskFn Fungsi cetak yang mengembalikan Promise
 * @returns {Promise<any>}
 */
function enqueuePrint(printerKey, taskFn) {
  const key = String(printerKey || "default").trim().toLowerCase();

  // Hitung jumlah job yang sedang menunggu di antrean
  const currentCount = queueCounts.get(key) || 0;
  queueCounts.set(key, currentCount + 1);

  const previousTask = queues.get(key) || Promise.resolve();

  const currentTask = new Promise((resolve, reject) => {
    previousTask
      .catch(() => {}) // Error pada job sebelumnya tidak boleh membatalkan job berikutnya
      .finally(async () => {
        try {
          const result = await taskFn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          const count = queueCounts.get(key) || 1;
          if (count <= 1) {
            queueCounts.delete(key);
            queues.delete(key);
          } else {
            queueCounts.set(key, count - 1);
          }
        }
      });
  });

  queues.set(key, currentTask);
  return currentTask;
}

/**
 * Cek status antrean seluruh printer yang sedang aktif
 * @returns {Record<string, { pendingJobs: number, isBusy: boolean }>}
 */
function getQueueStatus() {
  const status = {};
  for (const [key, count] of queueCounts.entries()) {
    status[key] = {
      pendingJobs: count,
      isBusy: count > 0,
    };
  }
  return status;
}

module.exports = {
  enqueuePrint,
  getQueueStatus,
};
