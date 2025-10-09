"use strict";

const express = require("express");
const router = express.Router();
const resumedetailsController = require("../controllers/resumedetails.controller");


router.put("/update/:id", resumedetailsController.updateResumeFields);
router.get("/analysis/:teamManagerId", resumedetailsController.getResumeAnalysis);
router.get("/total-analysis/:teamManagerId", resumedetailsController.gettotalResumeAnalysis);
router.get("/analysis-per-cosheet/:teamManagerId", resumedetailsController.getResumeAnalysisPerCoSheet);
router.get("/followup-totals", resumedetailsController.getFollowUpResumeTotals);
router.get("/followup-data/:teamManagerId", resumedetailsController.getFollowUpData);
router.get("/followups/resumes-received/:teamManagerId", resumedetailsController.getResumesReceived);
router.get("/followups/sending-in-1-2-days/:teamManagerId", resumedetailsController.getSendingIn12Days);
router.get("/followups/delayed/:teamManagerId", resumedetailsController.getDelayed);
router.get("/followups/no-response/:teamManagerId", resumedetailsController.getNoResponse);
router.get("/followups/unprofessional/:teamManagerId", resumedetailsController.getUnprofessional);
router.get("/followups/pending", resumedetailsController.getAllPendingFollowUps);
router.post("/send-followup-email/:id", resumedetailsController.sendFollowUpEmail);

module.exports = router;
