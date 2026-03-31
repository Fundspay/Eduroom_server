"use strict";
const express = require("express");
const router = express.Router();
const isheetController = require("../controllers/isheet.controller");

router.get("/analysis", isheetController.fetchC1ScheduledDetails);
router.put("/update-followup/:id", isheetController.updateASheetFollowupFields);
router.get("/c1-scheduled/:teamManagerId", isheetController.getC1ScheduledByTeamManager);
router.get("/follow-ups", isheetController.getAllFollowUps);
router.get("/notintrested", isheetController.getAllNotintrested);
router.get("/dicey", isheetController.getAllDicey);
router.get("/fetchSubscriptionDetails", isheetController.fetchSubscriptionC1AndMSheetDetails);

module.exports = router;