"use strict";
const express = require("express");
const router = express.Router();
const offerletterController = require("../controllers/offerletter.conotroller");


// ✅ Offer Letter Routes
router.post("/send/:userId", offerletterController.sendOfferLetter);

module.exports = router;
