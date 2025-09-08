const express = require("express");
const router = express.Router();
const courseController = require("../controllers/course.controller");

// ✅ Course Routes
router.post("/add", courseController.addCourse);
router.get("/list", courseController.fetchAllCourses);
router.get("/list/:id", courseController.fetchSingleCourse);
router.put("/update/:id", courseController.updateCourse);
router.delete("/delete/:id", courseController.deleteCourse);
router.get("/course/:domainId", courseController.fetchCoursesByDomain);

module.exports = router;