const express = require("express");
const router = express.Router();
const raisequeryController = require("../controllers/raisequery.controller");


router.post("/add", raisequeryController.addRaiseQuery);
router.get("/list", raisequeryController.fetchAllRaiseQueries);
router.get("/list/:userId", raisequeryController.fetchRaiseQueriesByUser);
router.get("/list/:id", raisequeryController.fetchSingleRaiseQuery);
router.put("/update/:userId", raisequeryController.updateRaiseQueryByUser);

module.exports = router;
