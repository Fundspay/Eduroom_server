// routes/analysis.route.js
"use strict";
const express = require("express");
const router = express.Router();
const analysisController = require("../controllers/analysis.controller");

// GET Daily Connect Analysis (planned targets only)
// Example: /api/analysis/daily?userId=123&startDate=2025-08-01&endDate=2025-08-10
router.get("/daily", analysisController.getDailyAnalysis);

// GET Connected CoSheets by Team Manager ID
router.get("/connected/:teamManagerId", analysisController.getConnectedCoSheetsByManager);

// routes/analysis.route.js
router.put("/connected/:id", analysisController.updateConnectedCoSheet);

router.get("/counts/:teamManagerId", analysisController.getCoSheetsWithCounts);

module.exports = router;
