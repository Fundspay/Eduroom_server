const express = require("express");
const router = express.Router();
const fundsauditController = require("../controllers/fundsaudit.controller");

// ✅ FundsAudit Routes
router.post("/add", fundsauditController.addFundsAudit);               
router.get("/all", fundsauditController.fetchAllFundsAudit);          
router.get("/list/:id", fundsauditController.fetchSingleFundsAudit);  
router.put("/update/:id", fundsauditController.updateFundsAudit);    
router.delete("/delete/:id", fundsauditController.deleteFundsAudit);  
router.get("/list", fundsauditController.listAllFundsAudit);
router.get ("/byname", fundsauditController.listAllFundsAuditByUser); 
router.get ("/bycollege", fundsauditController.listAllFundsAuditByCollege); // List all records by college ID



module.exports = router;
