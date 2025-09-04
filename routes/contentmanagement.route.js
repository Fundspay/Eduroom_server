"use strict";
const express = require("express");
const router = express.Router();
const contentmanagementController = require("../controllers/contentmanagement.controller");


router.post("/add", contentmanagementController.createCourse);
router.get("/list", contentmanagementController.getAllCourses);
router.get("/course/:id", contentmanagementController.getCourseById);
router.put("/course/:id", contentmanagementController.updateCourse);
router.delete("/course/:id", contentmanagementController.deleteCourse);
router.get('/:id/tutor', contentmanagementController.getCourseWithTutorById);
router.get('/:id/mcqs', contentmanagementController. getCourseMCQsAndYouTube);
router.post('/:id/evaluate', contentmanagementController.evaluateCourseMCQ);
router.get('/:id/case-studies', contentmanagementController.getCaseStudiesByCourseId);
router.post('/:id/case-studies/evaluate', contentmanagementController.evaluateCaseStudies);




module.exports = router;