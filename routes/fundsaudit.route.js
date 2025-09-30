const express = require("express");
const router = express.Router();
const fundsauditController = require("../controllers/fundsaudit.controller");

// ✅ FundsAudit Routes
router.post("/add", fundsauditController.addFundsAudit);               
router.get("/all", fundsauditController.fetchAllFundsAudit);          
router.get("/list/:id", fundsauditController.fetchSingleFundsAudit);  
router.put("/update/:id", fundsauditController.updateFundsAudit);     // Update record by ID
router.delete("/delete/:id", fundsauditController.deleteFundsAudit);  // Delete record by ID
router.get("/list", fundsauditController.listAllFundsAudit);          // List all records with pagination
router.get ("/byname", fundsauditController.listAllFundsAuditByUser); // List all records by user ID
router.get ("/bycollege", fundsauditController.listAllFundsAuditByCollege); // List all records by college ID



module.exports = router;
