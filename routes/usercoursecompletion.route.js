const express = require("express");
const router = express.Router();
const usercoursecompletionController = require("../controllers/usercoursecompletion.controller");

// POST /api/courses/complete
router.post("/complete", usercoursecompletionController.completeCourseAndSendCertificate);

module.exports = router;
