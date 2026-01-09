"use strict";

const model = require("../models");
const { ReE, ReS } = require("../utils/util.service");
const { Op } = require("sequelize");
const { calculateSystemTaskProgress } = require("./tasktype.controller");


// GET month-wise calendar
var getTaskCalendar = async function (req, res) {
  try {
    const { managerId, month } = req.query;

    if (!managerId || !month) {
      return ReE(res, "managerId and month are required", 400);
    }

    // month format: YYYY-MM
    const startDate = `${month}-01`;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);

    // fetch existing rows
    const records = await model.TaskCalendarDay.findAll({
      where: {
        teamManagerId: managerId,
        taskDate: {
          [Op.between]: [startDate, endDate.toISOString().split("T")[0]],
        },
        isDeleted: false,
      },
    });

    // map existing records by date
    const recordMap = {};
    records.forEach((r) => {
      recordMap[r.taskDate] = r;
    });

    // build full calendar
    const daysInMonth = endDate.getDate();
    const calendar = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const record = recordMap[date];

      const dayName = new Date(date).toLocaleDateString("en-US", {
        weekday: "short",
      });

      calendar.push({
        date,
        day: dayName,
        dayProgress: record ? record.dayProgress : null,
      });
    }

    return ReS(res, { success: true, calendar }, 200);
  } catch (error) {
    console.error("Error fetching task calendar:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getTaskCalendar = getTaskCalendar;


/**
 * Generate next small taskId (t1, t2...)
 */
const getNextTaskId = (tasks = []) => {
  if (!tasks.length) return "t1";

  const nums = tasks
    .map(t => parseInt(String(t.taskId).replace("t", ""), 10))
    .filter(n => !isNaN(n));

  const max = nums.length ? Math.max(...nums) : 0;
  return `t${max + 1}`;
};

/**
 * UPSERT task for a manager & date
 * POST /task-calendar/upsert
 */
// Mapping of default modes by taskType
const defaultModeByTaskType = {
  "HR [COLLEGE CONNECT]": "SYSTEM",
  "HR [JD SEND]": "SYSTEM",
  "HR [FOLLOW UP]": "SYSTEM",
  "HR [RESUME RECEVIED]": "SYSTEM",
  "HR [SELECTED-COLLEGES]": "SYSTEM",
  "HR [SELECTION]": "SYSTEM",

  // 🔹 BD TASKS
  "BD [INTERNS ALLOCATED]": "SYSTEM",
  "BD [INTERNS ACTIVE]": "SYSTEM",
  "BD [ACCOUNTS]": "SYSTEM",

  // 🔹 BD DAY TASKS (same as BD [ACCOUNTS])
  "BD [DAY 0]": "SYSTEM",
  "BD [DAY 1]": "SYSTEM",
  "BD [DAY 2]": "SYSTEM",
  "BD [DAY 3]": "SYSTEM",
  "BD [DAY 4]": "SYSTEM",
  "BD [DAY 5]": "SYSTEM",
  "BD [DAY 6]": "SYSTEM",
  "BD [DAY 7]": "SYSTEM",
};


// ---------------- TASK WEIGHTAGE RULES ----------------
const taskWeightageRules = {
  1: [100],                               // Rule 4: 1 task
  2: [70, 30],                            // Rule 3: 2 tasks
  3: [70, 30, 0],                         // Rule 2: 3 tasks
  4: [60, 30, 10, 0],                     // Rule 1: 4 tasks
  5: [50, 20, 15, 10, 5],                 // Rule 5: 5 tasks
  6: [40, 20, 15, 10, 10, 5],             // Rule 6: 6 tasks
};

var upsertTaskForDay = async function (req, res) {
  try {
    const { managerId, date, task } = req.body;

    if (!managerId || !date || !task) {
      return ReE(res, "managerId, date and task are required", 400);
    }

    const [dayRecord] = await model.TaskCalendarDay.findOrCreate({
      where: { teamManagerId: managerId, taskDate: date },
      defaults: { tasks: [], dayProgress: null },
    });

    let tasks = Array.isArray(dayRecord.tasks) ? [...dayRecord.tasks] : [];

    // ---------------- ADD TASK ----------------
    if (!task.taskId) {
      const mode = task.mode || defaultModeByTaskType[task.taskType] || "MANUAL";

      const newTask = {
        taskId: getNextTaskId(tasks),
        taskType: task.taskType || null,
        title: task.title,
        mode,
        status: task.status || "NORMAL",
        order: tasks.length + 1,
      };

      // -------- SYSTEM --------
      if (mode === "SYSTEM" && newTask.taskType) {
        const { calculateSystemTaskProgress } = require("./tasktype.controller");
        const r = await calculateSystemTaskProgress({ taskType: newTask.taskType, managerId, date });

        const achieved = r.achieved ?? 0;
        const target = r.target ?? 0;

        newTask.achieved = achieved;
        newTask.target = target;
        newTask.progress = `${achieved}/${target}`;
        newTask.result = target > 0 ? Math.round((achieved / target) * 100) : 0;
      }

      // -------- MANUAL --------
      if (mode === "MANUAL") {
        const progress = task.progress ?? "0";
        const parsed = parseFloat(progress.toString().replace("%", ""));
        newTask.progress = progress.toString();
        newTask.result = isNaN(parsed) ? 0 : parsed;
      }

      tasks.push(newTask);
    }

    // ---------------- UPDATE TASK ----------------
    if (task.taskId) {
      const index = tasks.findIndex(t => t.taskId === task.taskId);
      if (index === -1) return ReE(res, "Task not found for update", 404);

      const mode = tasks[index].mode;

      tasks[index] = {
        ...tasks[index],
        ...Object.fromEntries(Object.entries(task).filter(([k]) => !["taskId", "achieved", "target"].includes(k))),
      };

      // -------- SYSTEM --------
      if (mode === "SYSTEM" && tasks[index].taskType) {
        const { calculateSystemTaskProgress } = require("./tasktype.controller");
        const r = await calculateSystemTaskProgress({ taskType: tasks[index].taskType, managerId, date });

        const achieved = r.achieved ?? 0;
        const target = r.target ?? 0;

        tasks[index].achieved = achieved;
        tasks[index].target = target;
        tasks[index].progress = `${achieved}/${target}`;
        tasks[index].result = target > 0 ? Math.round((achieved / target) * 100) : 0;
      }

      // -------- MANUAL --------
      if (mode === "MANUAL" && task.progress !== undefined) {
        const parsed = parseFloat(task.progress.toString().replace("%", ""));
        tasks[index].progress = task.progress.toString();
        tasks[index].result = isNaN(parsed) ? 0 : parsed;

        // 🔥 ENSURE NO SYSTEM FIELDS EXIST
        delete tasks[index].achieved;
        delete tasks[index].target;
      }
    }

    // ---------------- DAY PROGRESS ----------------
    const validResults = tasks.map(t => t.result).filter(r => r !== null && r !== undefined);
    const resultsToConsider = validResults.slice(0, 6);
    const weightages = taskWeightageRules[resultsToConsider.length] || [];

    let dayProgress = null;
    if (resultsToConsider.length) {
      dayProgress = Math.round(
        resultsToConsider.reduce((sum, r, i) => sum + (r * (weightages[i] || 0)) / 100, 0)
      );
    }

    await dayRecord.update({ tasks, dayProgress });

    return ReS(res, { success: true, date, tasks, dayProgress }, 200);

  } catch (error) {
    console.error("Error upserting task:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.upsertTaskForDay = upsertTaskForDay;

// ---------------- GET TASK FOR DATE ----------------
var getTaskForDate = async function (req, res) {
  try {
    const { managerId, date } = req.query;

    if (!managerId || !date) return ReE(res, "managerId and date are required", 400);

    const record = await model.TaskCalendarDay.findOne({
      where: { teamManagerId: managerId, taskDate: date, isDeleted: false },
    });

    if (!record) {
      return ReS(res, { success: true, date, tasks: [], dayProgress: null }, 200);
    }

    let tasks = Array.isArray(record.tasks) ? [...record.tasks] : [];
    const { calculateSystemTaskProgress } = require("./tasktype.controller");

    for (let i = 0; i < tasks.length; i++) {
      // -------- SYSTEM --------
      if (tasks[i].mode === "SYSTEM" && tasks[i].taskType) {
        const r = await calculateSystemTaskProgress({ taskType: tasks[i].taskType, managerId, date });
        const achieved = r.achieved ?? 0;
        const target = r.target ?? 0;

        tasks[i].achieved = achieved;
        tasks[i].target = target;
        tasks[i].progress = `${achieved}/${target}`;
        tasks[i].result = target > 0 ? Math.round((achieved / target) * 100) : 0;
      }

      // -------- MANUAL --------
      if (tasks[i].mode === "MANUAL") {
        const parsed = parseFloat((tasks[i].progress ?? "0").toString().replace("%", ""));
        tasks[i].result = isNaN(parsed) ? 0 : parsed;

        //  GUARANTEE NO SYSTEM FIELDS
        delete tasks[i].achieved;
        delete tasks[i].target;
      }
    }

    const results = tasks.map(t => t.result).filter(r => r !== undefined).slice(0, 6);
    const weightages = taskWeightageRules[results.length] || [];

    let dayProgress = null;
    if (results.length) {
      dayProgress = Math.round(
        results.reduce((sum, r, i) => sum + (r * (weightages[i] || 0)) / 100, 0)
      );
    }

    await record.update({ tasks, dayProgress });

    return ReS(res, { success: true, date, tasks, dayProgress }, 200);

  } catch (error) {
    console.error("Error fetching task for date:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getTaskForDate = getTaskForDate;




