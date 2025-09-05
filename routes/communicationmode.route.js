const express = require("express");
const router = express.Router();
const communicationmodeController = require("../controllers/communicationmode.controller");

router.post("/add", communicationmodeController.add);
router.get("/list", communicationmodeController.fetchAll);
router.get("/list/:id", communicationmodeController.fetchSingle);
router.put("/update/:id", communicationmodeController.updateComm);
router.delete("/delete/:id", communicationmodeController.deleteComm);

module.exports = router;
