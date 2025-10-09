"use strict";
const express = require("express");
const router = express.Router();
const studentresumeController = require("../controllers/studentresume.controller"); 


// ✅ Resume CRUD

router.post("/create", studentresumeController.createResume);
router.put("/update/:id", studentresumeController.updateResume);
router.get("/list", studentresumeController.listResumes);
router.get("/list/user/:userId", studentresumeController.listResumesByUserId);
router.delete("/delete/:id", studentresumeController.deleteResume);
router.get("/work-analysis", studentresumeController.getUserTargetAnalysis);
router.post("/send-mail/:id",studentresumeController.sendMailToStudent);

router.get("/list/user/future/:userId", studentresumeController.listResumesByUserIdfuture);

router.get("/resumes-achieved", studentresumeController.getUserResumesAchieved);

// --- Interviews Achieved (total + rows) ---
router.get("/interviews-achieved", studentresumeController.getUserInterviewsAchieved);
// Example: GET /analysis/college?userId=123
router.get("/college", studentresumeController.getCollegeAnalysis);

// Daily calendar analysis (needs userId + optional date range)
// Example: GET /analysis/daily-calendar?userId=123&fromDate=2025-08-01&toDate=2025-08-31
router.get("/daily-calendar", studentresumeController.getDailyCalendarAnalysis);

// User-wise work analysis (filters by date range)
// Example: GET /analysis/user-work?fromDate=2025-08-01&toDate=2025-08-15
router.get("/user-work", studentresumeController.getUserWorkAnalysis);

//  Response & performance analysis (filters by date range)
// Example: GET /analysis/response?fromDate=2025-08-01&toDate=2025-08-31
router.get("/response", studentresumeController.getRAnalysis);



module.exports = router;
