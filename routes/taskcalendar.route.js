const express = require("express");
const router = express.Router();

const taskCalendarController = require("../controllers/taskcalendar.controller");

// 🔹 Get month-wise calendar for a manager
// Example: GET /task-calendar?managerId=39&month=2026-01
router.get("/calendar", taskCalendarController.getTaskCalendar);

// 🔹 Add / Update (Upsert) task for a given manager & date
// Example: POST /task-calendar/upsert
router.post("/upsert", taskCalendarController.upsertTaskForDay);

router.get("/daytask", taskCalendarController.getTaskForDate);

module.exports = router;
