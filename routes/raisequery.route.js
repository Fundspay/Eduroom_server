const express = require("express");
const router = express.Router();
const raisequeryController = require("../controllers/raisequery.controller");

// ✅ RaiseQuery Routes
router.post("/add", raisequeryController.addRaiseQuery);
router.get("/list", raisequeryController.fetchAllRaiseQueries);
router.get("/list/:id", raisequeryController.fetchSingleRaiseQuery);
router.put("/update/:id", raisequeryController.updateRaiseQuery);

module.exports = router;
