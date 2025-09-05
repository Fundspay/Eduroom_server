const express = require("express");
const router = express.Router();
const internshipmodeController = require("../controllers/internshipmode.controller");

router.post("/add", internshipmodeController.add);
router.get("/list", internshipmodeController.fetchAll);
router.get("/list/:id", internshipmodeController.fetchSingle);
router.put("/update/:id", internshipmodeController.updateMode);
router.delete("/delete/:id", internshipModeController.deleteMode);

module.exports = router;
