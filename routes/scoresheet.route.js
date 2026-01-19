"use strict";
const express = require("express");
const router = express.Router();
const scoresheetController = require("../controllers/scoresheet.controller");

router.post("/add", scoresheetController.upsertScoreSheet);

router.get("/list/:managerid", scoresheetController.getScoreSheet);

module.exports = router;