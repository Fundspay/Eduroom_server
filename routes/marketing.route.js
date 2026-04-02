"use strict";
const express = require("express");
const router = express.Router();
const marketingController = require("../controllers/marketing.controller");

router.post("/marketing/submit", marketingController.submitMarketing);
router.get("/marketing/fetch/:userId", marketingController.fetchMarketingByUser);
router.get("/marketing/summary/:userId", marketingController.fetchMarketingSummaryByUser);

module.exports = router;