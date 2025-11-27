"use strict";

const express = require("express");
const router = express.Router();

const calculatorController = require("../controllers/calculator.controller");

// INCENTIVE CALCULATOR ROUTE
router.get("/incentive", calculatorController.calculateIncentive);

module.exports = router;