const express = require("express");
const router = express.Router();
const coursedetailController = require("../controllers/coursedetail.controller");

//  Add new CourseDetail (per session)
router.post("/course-detail", coursedetailController.addOrUpdateCourseDetail);

// delete

router.delete("/delete/:id", coursedetailController.deleteCourseDetail);

//  Fetch all sessions by coursePreviewId (with MCQs)
router.get("/course-preview/:coursePreviewId/details", coursedetailController.fetchCourseDetailsByPreview);

// Fetch CourseDetails by coursePreviewId, day, and sessionNumber (with MCQs)
router.get(
  "/course-preview/:coursePreviewId/details-by-session",coursedetailController.fetchCourseDetailsByDayAndSession);


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

router.post("/course/start-end-dates", coursedetailController.setCourseStartEndDates);

router.get("/:userId", coursedetailController.getDailyStatusAllCoursesPerUser);

// GET user MCQ score for a specific session
router.get("/mcq/score/:courseId/:coursePreviewId/:day/:sessionNumber/:userId",coursedetailController.getUserMCQScore);

router.get(
  "/casestudy/result/:courseId/:coursePreviewId/:day/:sessionNumber/:questionId/:userId",
  coursedetailController.getUserCaseStudyResult
);



module.exports = router;
