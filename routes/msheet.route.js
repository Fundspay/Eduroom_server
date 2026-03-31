"use strict";
const express = require("express");
const router = express.Router();
const MSheetController = require("../controllers/msheet.controller");

// ✅ Create or update MSheet
router.post("/upsert", MSheetController.upsertMSheet);

// ✅ Fetch MSheets by RM name (query param ?name=RM_NAME)
// ⚠️ This must come BEFORE /:id or /individual/:userId to avoid route conflicts
router.get("/byname", MSheetController.fetchSubscriptionC1AndMSheetDetailsByRM);

// ✅ Update MSheet by ID
router.put("/update/:id", MSheetController.updateMSheet);

// ✅ Fetch a single MSheet by ID
router.get("/:id", MSheetController.fetchMSheetById);

// ✅ Fetch all MSheets for a given user ID
router.get("/user/:userId", MSheetController.fetchMSheetsByUserId);

// ✅ Fetch all MSheets
router.get("/fetchall", MSheetController.fetchAllMSheets);

// ✅ Fetch individual MSheets for a user (RM perspective)
router.get("/individual/:userId", MSheetController.mgetMSheetsByUserId);

module.exports = router;
