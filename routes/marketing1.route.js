"use strict";

const express = require("express");
const router = express.Router();

const marketingController = require("../controllers/marketing1.controller");

router.post("/create", marketingController.createMarketing);
router.get("/list", marketingController.fetchAllMarketing);
router.get("/list/:id", marketingController.fetchSingleMarketing);
router.put("/update/:id", marketingController.updateMarketing);
router.delete("/delete/:id", marketingController.deleteMarketing);

module.exports = router;