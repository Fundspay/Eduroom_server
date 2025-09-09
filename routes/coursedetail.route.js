const express = require("express");
const router = express.Router();
const coursedetailController = require("../controllers/coursedetail.controller");

//  Add new CourseDetail (per session)
router.post("/course-detail", coursedetailController.addCourseDetail);

//  Fetch all sessions by coursePreviewId (with MCQs)
router.get("/course-preview/:coursePreviewId/details", coursedetailController.fetchCourseDetailsByPreview);

//  Evaluate MCQs for a session
router.post(
  "/course/:courseId/preview/:coursePreviewId/day/:day/session/:sessionNumber/evaluate",
  coursedetailController.evaluateSessionMCQ
);

//  Get case study for a session
router.get(
  "/course/:courseId/preview/:coursePreviewId/day/:day/session/:sessionNumber/casestudies",
  coursedetailController.getCaseStudyForSession
);

//  Submit case study answer for a session
router.post(
  "/course/:courseId/preview/:coursePreviewId/day/:day/session/:sessionNumber/question/:questionId/casestudy",
  coursedetailController.submitCaseStudyAnswer
);

//  Get session-wise status for a user
router.get(
  "/course/:courseId/preview/:coursePreviewId/user/:userId/sessionstatus",
  coursedetailController.getSessionStatusPerUser
);

//  Get overall course status (session-based)
router.get(
  "/course/:courseId/preview/:coursePreviewId/user/:userId/overallstatus",
  coursedetailController.getOverallCourseStatus
);

//  Business target (referrals)
router.get(
  "/course/:courseId/user/:userId/business-target",
  coursedetailController.getBusinessTarget
);

//  Get daily status for a user
router.get(
  "/course/:courseId/preview/:coursePreviewId/user/:userId/dailystatus",
  coursedetailController.getDailyStatusPerUser
);


module.exports = router;
