"use strict";
const express = require("express");
const router = express.Router();
const scoresheetController = require("../controllers/scoresheet.controller");

router.post("/add", scoresheetController.upsertScoreSheet);

router.get("/list/:managerid", scoresheetController.getScoreSheet);

router.get("/scoresheet/stats/:managerid", scoresheetController.getUserSessionStats);


module.exports = router;