"use strict";
const express = require("express");
const router = express.Router();
const myTarget1Controller = require("../controllers/mytarget1.controller");

router.post("/add", myTarget1Controller.handleTargets);
router.get("/fetch", myTarget1Controller.fetchTargets);
router.get("/c1targets", myTarget1Controller.fetchC1Target);

module.exports = router;
