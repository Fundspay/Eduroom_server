"use strict";

const express = require("express");
const router = express.Router();

const bdsheetController = require("../controllers/bdsheet.controller");

// UPSERT
router.post("/upsert", bdsheetController.upsertBdSheet);
router.get("/bdsheet", bdsheetController.getBdSheet);
router.get("/category", bdsheetController.getBdSheetByCategory);
router.get("/activestatus", bdsheetController.getBdAnalytics);


module.exports = router;
