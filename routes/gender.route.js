const express = require("express");
const router = express.Router();
const genderController = require("../controllers/gender.controller");

router.post("/add", genderController.add);
router.get("/list", genderController.fetchAll);
router.get("/list/:id", genderController.fetchSingle);
router.put("/update/:id", genderController.updateGender);
router.delete("/delete/:id", genderController.deleteGender);

module.exports = router;


