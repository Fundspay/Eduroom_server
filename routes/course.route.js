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
router.get("/status/:userId", courseController.getUserCourseStatus);
router.get("/status", courseController.getAllUsersCourseStatus);
router.get("/wallet/:userId", courseController.getUserWalletDetails);
router.get("/wallet", courseController.getAllUsersWalletDetails);

module.exports = router;