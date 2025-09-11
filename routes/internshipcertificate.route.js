const express = require("express");
const router = express.Router();
const internshipcertificateController = require("../controllers/internshipcertificate.controller");

// Create, deduct wallet, and send certificate in one step
router.post("/certificate/send", internshipcertificateController.createAndSendInternshipCertificate);

module.exports = router;
