"use strict";
const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");


router.post("/register", userController.addUser);
router.post("/login", userController.loginWithEmailPassword);
router.get("/list", userController.fetchAllUsers);
router.get("/list/:id", userController.fetchSingleUser);
router.put("/update/:id", userController.updateUser);
router.delete("/delete/:id", userController.deleteUser);
router.post("/password/request-reset", userController.requestPasswordReset);
router.post("/password/reset", userController.resetPassword);
router.post("/logout", userController.logoutUser);

module.exports = router;
