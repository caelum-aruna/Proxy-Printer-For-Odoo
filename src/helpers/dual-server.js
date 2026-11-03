// src/helpers/dual-server.js
// Listener multi-protokol (HTTP dan HTTPS bersamaan di port yang sama)
// Mendukung Odoo POS HTTPS (IoT Box) dan HTTP lokal tanpa konflik port.

const net = require("net");
const http = require("http");
const tls = require("tls");
const { getSecureContext } = require("./cert-manager");

/**
 * Buat server yang mampu melayani request HTTP dan HTTPS di port yang sama.
 * @param {import("express").Express} app - Express application
 * @returns {net.Server}
 */
function createDualServer(app) {
  const secureContext = getSecureContext();
  const httpServer = http.createServer(app);

  const server = net.createServer((socket) => {
    socket.once("data", (buffer) => {
      socket.pause();
      socket.unshift(buffer);

      // Byte 22 (0x16) adalah TLS Record Header (ClientHello handshake)
      if (buffer[0] === 22) {
        try {
          const tlsSocket = new tls.TLSSocket(socket, {
            isServer: true,
            secureContext,
          });

          tlsSocket.on("error", (err) => {
            // Abaikan error handshake biasa (misal browser belum accept certificate)
            if (err.code !== "ECONNRESET") {
              // logger.debug / ignore
            }
          });

          httpServer.emit("connection", tlsSocket);
        } catch (tlsErr) {
          socket.destroy();
        }
      } else {
        // Request biasa (Plain HTTP)
        httpServer.emit("connection", socket);
      }

      process.nextTick(() => {
        if (!socket.destroyed) {
          socket.resume();
        }
      });
    });

    socket.on("error", () => {
      // Ignore socket errors
    });
  });

  return server;
}

module.exports = {
  createDualServer,
};
