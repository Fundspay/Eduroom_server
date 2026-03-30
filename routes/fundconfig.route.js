const express = require("express");
const router = express.Router();

const fundConfigController = require("../controllers/fundconfig.controller");

router.get("/fetch", fundConfigController.getConfig);
router.post("/create", fundConfigController.createConfig);
router.post("/list", fundConfigController.getAllConfigs);
router.get("/fetch/:managerId", fundConfigController.getConf);

router.put("/update/:id", fundConfigController.updateConfig);
router.delete("/delete", fundConfigController.deleteConfig);
router.post("/calculate/:id", fundConfigController.calculateAchievement);
router.post("/final-report/:id", fundConfigController.finalReport);

module.exports = router;