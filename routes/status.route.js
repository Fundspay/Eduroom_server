const express = require("express");
const router = express.Router();
const statuscontroller = require("../controllers/status.controller");

// ✅ Status Routes
router.get("/listall", statuscontroller.listAll);          // Fetch all statuses (non-deleted only)
router.put("/update/:id", statuscontroller.updateStatus);  // Update only teamManager

module.exports = router;
