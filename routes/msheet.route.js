"use strict";
const express = require("express");
const router = express.Router();
const MSheetController = require("../controllers/msheet.controller");

router.post("/upsert", MSheetController.upsertMSheet);
router.get("/byname", MSheetController.fetchSubscriptionC1AndMSheetDetailsByRM);
router.put("/update/:id", MSheetController.updateMSheet);
router.get("/:id", MSheetController.fetchMSheetById);
router.get("/manager/:teamManagerId", MSheetController.fetchMSheetsByTeamManagerId);
router.get("/fetchall", MSheetController.fetchAllMSheets);
router.get("/individual/:teamManagerId", MSheetController.mgetMSheetsByTeamManagerId);

module.exports = router;