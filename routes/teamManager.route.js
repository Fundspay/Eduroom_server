const express = require("express");
const router = express.Router();
const managerController = require("../controllers/teamManager.controller");

// 🔹 Register Manager
router.post("/register", managerController.registerTeamManager);

// 🔹 Get All Managers
router.get("/all", managerController.getAllTeamManagers);

module.exports = router;
