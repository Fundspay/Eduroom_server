const express = require("express");
const router = express.Router();

const fundConfigController = require("../controllers/fundsconfigController");

router.post("/create", fundConfigController.createConfig);
router.post("/list", fundConfigController.getAllConfigs);
router.get("/get/:id", fundConfigController.getConfig);
router.put("/update/:id", fundConfigController.updateConfig);
router.delete("/delete", fundConfigController.deleteConfig);

module.exports = router;