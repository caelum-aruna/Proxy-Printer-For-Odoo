// src/app.js
// Express app setup — middleware, logging, dan mount semua routes

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const { requestLoggerMiddleware } = require("./helpers/logger");
const dotmatrixRoutes = require("./routes/dotmatrix");
const posboxRoutes = require("./routes/posbox");
const receiptRoutes = require("./routes/receipt");
const printRoutes = require("./routes/print");
const statusRoutes = require("./routes/status");

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
// Enhanced CORS & Chrome Private Network Access (PNA) untuk Odoo POS IoT Box
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Private-Network", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD");

  // Refleksikan semua headers yang diminta oleh browser saat CORS preflight (misal: x-debug-mode dari Odoo saat ?debug=1)
  const requestedHeaders = req.headers["access-control-request-headers"];
  if (requestedHeaders) {
    res.header("Access-Control-Allow-Headers", requestedHeaders);
  } else {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-printer, x-debug-mode, session_id, Access-Control-Request-Private-Network, *"
    );
  }
  res.header("Access-Control-Expose-Headers", "*");
  res.header("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});
app.use(cors({ origin: true, credentials: true }));

// Favicon handler agar tidak memicu 404
app.get("/favicon.ico", (req, res) => res.status(204).end());

// Endpoint unduh sertifikat SSL proxy langsung dari browser kasir
app.get(["/server.crt", "/cert"], (req, res) => {
  const certPath = path.join(__dirname, "../certs/server.crt");
  if (fs.existsSync(certPath)) {
    res.setHeader("Content-Type", "application/x-x509-ca-cert");
    res.setHeader("Content-Disposition", 'attachment; filename="server.crt"');
    return res.sendFile(certPath);
  }
  res.status(404).send("Sertifikat belum digenerate");
});

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(express.text({ type: ["text/xml", "application/xml", "text/plain"], limit: "20mb" }));

// Persistent request & response file logger
app.use(requestLoggerMiddleware());

// Static frontend web dashboard
app.use(express.static(path.join(__dirname, "../public")));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use("/dotmatrix", dotmatrixRoutes);
app.use("/hw_proxy", posboxRoutes);
app.use("/:printer/hw_proxy", posboxRoutes);
app.use("/hw_drivers", posboxRoutes);
app.use("/:printer/hw_drivers", posboxRoutes);
app.use("/print/receipt", receiptRoutes);
app.use("/print", printRoutes);
app.use("/", statusRoutes);

module.exports = app;
