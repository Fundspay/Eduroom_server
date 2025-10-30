const express = require("express");
const router = express.Router();
const selectedCourseDetailController = require("../controllers/selectedcoursedetail.controller");

// 🔹 Add or update SelectedCourseDetail (per session)
router.post("/selected-course", selectedCourseDetailController.addOrUpdateSelectedCourseDetail);

// 🔹 Delete SelectedCourseDetail (by ID or by domain/day/session)
router.delete(
  "/delete/:selectedCourseDetailId",
  selectedCourseDetailController.deleteSelectedCourseDetail
);

router.get("/details/:selectedDomainId", selectedCourseDetailController.getSelectedCourseDetail);

router.post("/evaluate/:selectedDomainId", selectedCourseDetailController.evaluateSelectedMCQ);

router.post("/evaluate-case-study/:selectedDomainId/:questionId", selectedCourseDetailController.evaluateCaseStudyAnswer);

module.exports = router;
