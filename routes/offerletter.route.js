"use strict";
const express = require("express");
const router = express.Router();
const offerletterController = require("../controllers/offerletter.controller");


// ✅ Offer Letter Routes
router.post("/send/:userId/:courseId", offerletterController.sendOfferLetter);
router.post("/send-report/:userId/:courseId", offerletterController.sendInternshipReport);
router.get("/users/all", offerletterController.listAllUsers);
router.post("/certificate/send/:userId", offerletterController.sendCertificate);
router.post("/send-offer-letters", offerletterController.autoSendOfferLetters);

module.exports = router;


