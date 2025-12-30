const express = require("express");
const router = express.Router();
const analysis1Controller = require("../controllers/analysis1.controller");

// Extract and store selected course dates
router.get("/extract-course-dates", analysis1Controller.extractAndStoreCourseDates);
// Fetch all stored selected courses
router.get("/list", analysis1Controller.fetchAllStoredCourses);
// Fetch selected courses for a specific user
router.get("/list/:userId", analysis1Controller.fetchStoredCoursesByUser);
// Update stored course details by record ID
router.put("/update/:userId", analysis1Controller.updateStoredCourse);
//analysis 
router.get("/analysis/:userId", analysis1Controller.getUserAnalysis);
//update the work status
router.post("/user/day-work/", analysis1Controller.upsertUserDayWork);




module.exports = router;
