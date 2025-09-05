const express = require("express");
const router = express.Router();
const domainController = require("../controllers/domain.controller");

// ✅ Domain Routes
router.post("/add", domainController.addDomain);
router.get("/list", domainController.fetchAllDomains);
router.get("/list/:id", domainController.fetchSingleDomain);
router.put("/update/:id", domainController.updateDomain);
router.delete("/delete/:id", domainController.deleteDomain);

module.exports = router;
