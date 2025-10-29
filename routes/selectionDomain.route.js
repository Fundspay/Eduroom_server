const express = require("express");
const router = express.Router();
const selectionDomainController = require("../controllers/selectionDomain.controller");

// Selection Domain Routes
router.post("/add", selectionDomainController.addSelectionDomain);
router.get("/list", selectionDomainController.fetchAllSelectionDomains);
router.get("/list/:id", selectionDomainController.fetchSingleSelectionDomain);
router.put("/update/:id", selectionDomainController.updateSelectionDomain);
router.delete("/delete/:id", selectionDomainController.deleteSelectionDomain);

module.exports = router;
