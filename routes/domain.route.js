const express = require("express");
const router = express.Router();
const domaintypeController = require("../controllers/domaintype.controller");

// ✅ DomainType Routes
router.post("/add", domaintypeController.addDomainType);
router.get("/list", domaintypeController.fetchAllDomainTypes);
router.get("/list/:id", domaintypeController.fetchSingleDomainType);
router.put("/update/:id", domaintypeController.updateDomainType);
router.delete("/delete/:id", domaintypeController.deleteDomainType);

module.exports = router;
