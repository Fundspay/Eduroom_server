const express = require("express");
const router = express.Router();

const ContactUsController = require("../controllers/contactus.controller");

router.post("/add", ContactUsController.add);
router.post("/list", ContactUsController.fetchByUser);
router.delete('/delete', ContactUsController.deleteContact);



module.exports = router;
