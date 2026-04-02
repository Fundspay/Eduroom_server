const express = require("express");
const router = express.Router();

const ManagerReviewController = require("../controllers/managerreview.controller");

router.post("/submit", ManagerReviewController.submitReview);
router.post("/monthly-summary", ManagerReviewController.getMonthlySummary);
router.post("/list", ManagerReviewController.getReviewsByManager);
router.put("/update", ManagerReviewController.updateReview);
router.delete("/delete", ManagerReviewController.deleteReview);
router.get("/all-reviews/:managerId", ManagerReviewController.getAllReviews);

module.exports = router;