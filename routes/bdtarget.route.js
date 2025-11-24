"use strict";
const express = require("express");
const router = express.Router();
const bdTargetController = require("../controllers/bdtarget.controller");

router.post("/add", bdTargetController.handleBdTargets);
router.get("/fetch", bdTargetController.fetchBdTargets);

module.exports = router;
