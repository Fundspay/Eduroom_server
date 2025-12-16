"use strict";

const express = require("express");
const router = express.Router();

const bdsheetController = require("../controllers/bdsheet.controller");

// UPSERT
router.post("/upsert", bdsheetController.upsertBdSheet);
router.get("/bdsheet", bdsheetController.getBdSheet);
router.get("/category", bdsheetController.getBdSheetByCategory);
router.get("/activestatus", bdsheetController.getDashboardStats);
router.post("/amount", bdsheetController.upsertRangeAmounts);
router.get("/ranges", bdsheetController.getManagerRangeAmounts);
router.get("/date-range", bdsheetController.getBdSheetByDateRange);
router.get('/target-vs-achieved', bdsheetController.getTargetVsAchieved);
router.get('/bd-tl-leaderboard', bdsheetController.getBdTlLeaderboard);
router.get('/account-target-vs-achieved', bdsheetController.getAccountTargetVsAchieved);


module.exports = router;
