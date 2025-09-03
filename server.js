require("dotenv").config(); 

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const expressWinston = require("express-winston");

const model = require("./models/index");
const CONFIG = require("./config/config");
const v1 = require("./routes/v1");
const logger = require("./utils/logger.service");

const app = express();

// ────── GLOBAL MIDDLEWARE ───────────────────────────────
app.disable("x-powered-by");

// Body parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Gzip compression
app.use(compression());

// ────── CORS ───────────────────────────────────────────
const corsOptions = {
  origin: "*",
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", 'Accept'],
  credentials: true,
  optionsSuccessStatus: 204
};

// Apply CORS globally
app.use(cors(corsOptions));

// Ensure CORS headers are always set
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", corsOptions.methods.join(","));
  res.header("Access-Control-Allow-Headers", corsOptions.allowedHeaders.join(","));
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(corsOptions.optionsSuccessStatus);
  }
  next();
});

// ────── LOGGING (before routes) ─────────────────────────
app.use(
  expressWinston.logger({
    winstonInstance: logger,
    expressFormat: true,
    ignoreRoute: req => req.path === "/api/healthz"
  })
);

// ────── API ROUTES ─────────────────────────────────────
app.use("/api/v1", v1);

// ────── HEALTH CHECK ───────────────────────────────────
app.get("/api/healthz", async (req, res) => {
  try {
    const result = await model.sequelize.query("SELECT 1+1 AS result", {
      type: model.sequelize.QueryTypes.SELECT
    });

    return result[0].result === 2
      ? res.status(200).send("OK")
      : res.status(500).send("Database Error");
  } catch (error) {
    logger.error("Health check failed", error);
    return res.status(500).send("Database Error");
  }
});

// ────── ERROR LOGGER ────────────────────────────────────
app.use(
  expressWinston.errorLogger({
    winstonInstance: logger,
    expressFormat: true
  })
);

// ────── DATABASE SYNC ───────────────────────────────────
model.sequelize
  .authenticate()
  .then(() => logger.info("sequelize: Database Connection Success"))
  .then(() => model.sequelize.sync())
  .then(() => logger.info("sequelize: Database Sync Success"))
  .catch(err => {
    logger.error("sequelize: Database Init Failed", err);
    process.exit(1);
  });

// ────── START SERVER ───────────────────────────────────
const PORT = CONFIG.port || 3000;
app.listen(PORT, () =>
  logger.info(`express: Listening on port ${PORT}`)
);

module.exports = app;
