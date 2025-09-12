"use strict";
const express = require("express");
const router = express.Router();
const offerletterController = require("../controllers/offerletter.controller");


// ✅ Offer Letter Routes
router.post("/send/:userId", offerletterController.sendOfferLetter);
router.get("/users/all", offerletterController.listAllUsers);

module.exports = router;
