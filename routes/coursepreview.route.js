const express = require("express");
const router = express.Router();
const coursepreviewController = require("../controllers/coursepreview.controller");

// ✅ Add a new CoursePreview
router.post("/course-preview", coursepreviewController.addCoursePreview);
router.get("/course-previews", coursepreviewController.fetchAllCoursePreviews);
router.get("/course-preview/:id", coursepreviewController.fetchSingleCoursePreview);
router.put("/course-preview/:id", coursepreviewController.updateCoursePreview);
router.delete("/course-preview/:id", coursepreviewController.deleteCoursePreview);
router.get("/previews/:courseId", coursepreviewController.fetchPreviewsByCourse);

module.exports = router;
