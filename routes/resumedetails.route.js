"use strict";

const express = require("express");
const router = express.Router();
const resumedetailsController = require("../controllers/resumedetails.controller");


router.put("/update/:id", resumedetailsController.updateResumeFields);
router.get("/analysis/:userId", resumedetailsController.getResumeAnalysis);
router.get("/total-analysis/:userId", resumedetailsController.gettotalResumeAnalysis);
router.get("/analysis-per-cosheet/:userId", resumedetailsController.getResumeAnalysisPerCoSheet);
router.get("/followup-totals", resumedetailsController.getFollowUpResumeTotals);
router.get("/followup-data/:userId", resumedetailsController.getFollowUpData);
router.get("/followups/resumes-received/:userId", resumedetailsController.getResumesReceived);
router.get("/followups/sending-in-1-2-days/:userId", resumedetailsController.getSendingIn12Days);
router.get("/followups/delayed/:userId", resumedetailsController.getDelayed);
router.get("/followups/no-response/:userId", resumedetailsController.getNoResponse);
router.get("/followups/unprofessional/:userId", resumedetailsController.getUnprofessional);
router.get("/followups/pending", resumedetailsController.getAllPendingFollowUps);
router.post("/send-followup-email/:id", resumedetailsController.sendFollowUpEmail);

module.exports = router;
