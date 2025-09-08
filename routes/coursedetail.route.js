const express = require("express");
const router = express.Router();
const coursedetailController = require("../controllers/coursedetail.controller");

router.post("/course-detail", coursedetailController.addCourseDetail);
router.get("/course-preview/:coursePreviewId/details", coursedetailController.fetchCourseDetailsByPreview);
router.post("/course/:courseId/preview/:coursePreviewId/day/:day/evaluate", coursedetailController.evaluateDayMCQ);
router.get(
    "/course/:courseId/preview/:coursePreviewId/day/:day/casestudies",
    coursedetailController.getCaseStudiesForDay
);

// Submit case study answer
router.post(
    "/course/:courseId/preview/:coursePreviewId/day/:day/question/:questionId/casestudy",
    coursedetailController.submitCaseStudyAnswer
);
router.get(
    "/course/:courseId/preview/:coursePreviewId/user/:userId/dailystatus",
    coursedetailController.getDailyStatusPerUser
);
router.get(
    "/course/:courseId/preview/:coursePreviewId/user/:userId/overallstatus",
    coursedetailController.getOverallCourseStatus
);

router.get("/course/:courseId/user/:userId/business-target", coursedetailController.getBusinessTarget);

module.exports = router;