"use strict";
const express = require("express");
const router = express.Router();
const emailbodyController = require("../controllers/emailbody.controller");

router.post("/jdtemplate/upsert", emailbodyController.upsertJDTemplate);
router.get("/jdtemplate", emailbodyController.getJDTemplate);

module.exports = router;

