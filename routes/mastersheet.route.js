"use strict";
const express = require("express");
const router = express.Router();
const mastersheetController = require("../controllers/mastersheet.controller");

router.get("/matrics", mastersheetController.fetchMasterSheetTargets);

module.exports = router;