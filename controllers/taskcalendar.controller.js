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
      const taskType = task.taskType || null;
      const mode = defaultModeByTaskType[taskType] ? "SYSTEM" : "MANUAL";

      const newTask = {
        taskId: getNextTaskId(tasks),
        taskType,
        title: task.title,
        mode,
        status: task.status || "NORMAL",
        order: tasks.length + 1,
      };

      if (mode === "SYSTEM" && taskType) {
        const { calculateSystemTaskProgress } = require("./tasktype.controller");
        const r = await calculateSystemTaskProgress({ taskType, managerId, date });

        const achieved = r.achieved ?? 0;
        const target = r.target ?? 0;

        newTask.achieved = achieved;
        newTask.target = target;
        newTask.progress = `${achieved}/${target}`;
        newTask.result = target > 0 ? Math.round((achieved / target) * 100) : 0;
      } else {
        // MANUAL DEFAULTS
        newTask.progress = task.progress ?? "0";
        newTask.result = parseFloat(newTask.progress) || 0;
      }

      tasks.push(newTask);
    }

    // ---------------- UPDATE TASK ----------------
    if (task.taskId) {
      const index = tasks.findIndex(t => t.taskId === task.taskId);
      if (index === -1) return ReE(res, "Task not found", 404);

      const taskType = task.taskType ?? tasks[index].taskType;
      const mode = defaultModeByTaskType[taskType] ? "SYSTEM" : "MANUAL";

      tasks[index] = {
        ...tasks[index],
        ...task,
        taskType,
        mode,
      };

      if (mode === "SYSTEM") {
        const { calculateSystemTaskProgress } = require("./tasktype.controller");
        const r = await calculateSystemTaskProgress({ taskType, managerId, date });

        const achieved = r.achieved ?? 0;
        const target = r.target ?? 0;

        tasks[index].achieved = achieved;
        tasks[index].target = target;
        tasks[index].progress = `${achieved}/${target}`;
        tasks[index].result = target > 0 ? Math.round((achieved / target) * 100) : 0;
      } else {
        //  REMOVE SYSTEM FIELDS COMPLETELY
        delete tasks[index].achieved;
        delete tasks[index].target;

        tasks[index].progress = task.progress ?? tasks[index].progress ?? "0";
        tasks[index].result = parseFloat(tasks[index].progress) || 0;
      }
    }

    // ---------------- DAY PROGRESS ----------------
    const results = tasks.map(t => t.result).filter(r => r !== undefined);
    const resultsToConsider = results.slice(0, 6);
    const weightages = taskWeightageRules[resultsToConsider.length] || [];

    let dayProgress = null;
    if (weightages.length) {
      dayProgress = Math.round(
        resultsToConsider.reduce(
          (sum, r, i) => sum + (r * (weightages[i] || 0)) / 100,
          0
        )
      );
    }

    await dayRecord.update({ tasks, dayProgress });

    return ReS(res, { success: true, date, tasks, dayProgress }, 200);

  } catch (error) {
    console.error(error);
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




