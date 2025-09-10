const express = require("express");
const router = express.Router();
const teammanagerController = require("../controllers/teamManager.controller");

// 🔹 Register Manager
router.post("/register", teamManagerController.registerTeamManager);

// 🔹 Get All Managers
router.get("/all", teammanagerController.getAllTeamManagers);
router.put("/update/:managerId", teammanagerController.updateTeamManager);

module.exports = router;
