const express = require("express");
const router = express.Router();
const teamManagerController = require("../controllers/teamManager.controller");

// 🔹 Register Manager
router.post("/register", teamManagerController.registerTeamManager);

// 🔹 Get All Managers
router.get("/all", teamManagerController.getAllTeamManagers);
router.get("/fetch", teamManagerController.getTeamManagers);
router.put("/update/:managerId", teamManagerController.updateTeamManager);
router.put("/update-internship-manager", teamManagerController.updateManagerAssignment);

module.exports = router;
