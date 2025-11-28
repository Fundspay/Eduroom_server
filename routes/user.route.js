"use strict";
const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { firebaseAuth } = require('../middleware/auth.middleware');
const { uploadProfilePicture} = require("../middleware/s3.middleware");


router.post("/personal-info", userController.addPersonalInfo);
router.get("/users/date-range", userController.fetchUsersByDateRange);
router.put("/:userId/educational-details", userController.addEducationalDetails);
router.put("/:userId/internship-details", userController.addInternshipDetails);
router.post(
  "/:userId/verification-docs",
  uploadProfilePicture.fields([
    { name: "studentIdCard", maxCount: 1 },
    { name: "governmentIdProof", maxCount: 1 },
    { name: "passportPhoto", maxCount: 1 },
  ]),
  userController.addVerificationDocs
);
router.put("/:userId/bank-details", userController.addBankDetails);
router.put("/:userId/communication", userController.addCommunicationPreferences);
router.put("/:userId/consent", userController.addConsent);
router.post("/login", userController.loginWithEmailPassword);
router.put("/update-info/:id", userController.updatePersonalInfo);
router.get("/list", userController.fetchAllUsers);
router.get("/list/:id", userController.fetchSingleUser);
router.put("/update/:id", userController.updateUser);
router.delete("/delete/:id", userController.deleteUser);
router.post("/password/request-reset", userController.requestPasswordReset);
router.post("/password/reset", userController.resetPassword);
router.post("/logout", userController.logoutUser);
router.post('/google-login', firebaseAuth, userController.loginWithGoogle);

router.get("/profile/:id", userController.fetchSingleUserById);
router.get("/:userId/referral-payment-status", userController.getReferralPaymentStatus);
router.get("/:userId/internship-status", userController.getInternshipStatusByUser);
router.get("/course-dates", userController.getUserCourseDates);
router.get("/remaining-time/:userId", userController.getUserRemainingTime);
router.put("/user/business-info/:id", userController.updateBusinessTarget);
router.get("/referral/paid-count", userController.getReferralPaidCount);
module.exports = router;
