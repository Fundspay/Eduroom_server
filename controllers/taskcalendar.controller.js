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

      calendar.push({
        date,
        tasks: record ? record.tasks : [],
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
  "COLLEGE_CONNECT": "SYSTEM",
  "JD_SEND": "SYSTEM",
  "FOLLOW_UP": "SYSTEM",
  "RESUME_RECEIVED": "SYSTEM",
  "HR [SELECTED-COLLAGES]": "SYSTEM",
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

// ---------------- UPSERT TASK FOR DAY ----------------
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
      const newTask = {
        taskId: getNextTaskId(tasks),
        taskType: task.taskType || null,
        title: task.title,
        mode: task.mode || defaultModeByTaskType[task.taskType] || "MANUAL",
        status: task.status || "NORMAL",
        order: tasks.length + 1,
      };

      if (newTask.mode === "SYSTEM" && newTask.taskType) {
        const { calculateSystemTaskProgress } = require("./tasktype.controller");
        const r = await calculateSystemTaskProgress({ taskType: newTask.taskType, managerId, date });
        const achieved = r.achieved ?? 0;
        const target = r.target ?? 0;
        newTask.achieved = achieved;
        newTask.target = target;
        newTask.progress = `${achieved}/${target}`;
        newTask.result = target > 0 ? Math.round((achieved / target) * 100) : 0;
      } else if (newTask.mode === "MANUAL" && task.progress !== undefined) {
        let parsedResult = parseFloat(task.progress.toString().replace("%", ""));
        if (isNaN(parsedResult)) parsedResult = 0;
        newTask.result = parsedResult;
        newTask.achieved = 0;
        newTask.target = 0;
        newTask.progress = task.progress.toString();
      }

      tasks.push(newTask);
    }

    // ---------------- UPDATE TASK ----------------
    if (task.taskId) {
      const index = tasks.findIndex(t => t.taskId === task.taskId);
      if (index === -1) return ReE(res, "Task not found for update", 404);

      tasks[index] = {
        ...tasks[index],
        ...Object.fromEntries(Object.entries(task).filter(([key]) => key !== "taskId")),
        mode: task.mode || defaultModeByTaskType[tasks[index].taskType] || "MANUAL",
      };

      if (tasks[index].mode === "SYSTEM" && tasks[index].taskType) {
        const { calculateSystemTaskProgress } = require("./tasktype.controller");
        const r = await calculateSystemTaskProgress({ taskType: tasks[index].taskType, managerId, date });
        const achieved = r.achieved ?? 0;
        const target = r.target ?? 0;
        tasks[index].achieved = achieved;
        tasks[index].target = target;
        tasks[index].progress = `${achieved}/${target}`;
        tasks[index].result = target > 0 ? Math.round((achieved / target) * 100) : 0;
      } else if (tasks[index].mode === "MANUAL" && task.progress !== undefined) {
        let parsedResult = parseFloat(task.progress.toString().replace("%", ""));
        if (isNaN(parsedResult)) parsedResult = 0;
        tasks[index].result = parsedResult;
        tasks[index].achieved = 0;
        tasks[index].target = 0;
        tasks[index].progress = task.progress.toString();
      }
    }

    // ---------------- DAY PROGRESS WITH WEIGHTAGE ----------------
    const validResults = tasks.map(t => t.result).filter(r => r !== null && r !== undefined);

    // Only consider first 6 tasks for weightage
    const resultsToConsider = validResults.slice(0, 6);
    const numTasksForWeightage = resultsToConsider.length;
    const weightages = taskWeightageRules[numTasksForWeightage] || [];

    let dayProgress = null;
    if (resultsToConsider.length && weightages.length) {
      dayProgress = 0;
      for (let i = 0; i < numTasksForWeightage; i++) {
        const weight = weightages[i] ?? 0;
        dayProgress += (resultsToConsider[i] * weight) / 100;
      }
      dayProgress = Math.round(dayProgress);
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
      // ---------------- SYSTEM TASKS ----------------
      if (tasks[i].mode === "SYSTEM" && tasks[i].taskType) {
        const r = await calculateSystemTaskProgress({ taskType: tasks[i].taskType, managerId, date });
        const achieved = r.achieved ?? 0;
        const target = r.target ?? 0;
        tasks[i] = {
          ...tasks[i],
          achieved,
          target,
          progress: `${achieved}/${target}`,
          result: target > 0 ? Math.round((achieved / target) * 100) : 0,
        };
      }

      // ---------------- MANUAL TASKS ----------------
      if (tasks[i].mode === "MANUAL" && tasks[i].progress != null) {
        let manualResult = tasks[i].progress;
        if (typeof manualResult === "string" && manualResult.endsWith("%")) {
          manualResult = parseFloat(manualResult.replace("%", ""));
        } else {
          manualResult = parseFloat(manualResult);
        }
        tasks[i].result = isNaN(manualResult) ? 0 : manualResult;
      }
    }

    // ---------------- DAY PROGRESS WITH WEIGHTAGE ----------------
    const validResults = tasks.map(t => t.result).filter(r => r !== null && r !== undefined);

    // Only consider first 6 tasks for weightage
    const resultsToConsider = validResults.slice(0, 6);
    const numTasksForWeightage = resultsToConsider.length;
    const weightages = taskWeightageRules[numTasksForWeightage] || [];

    let dayProgress = null;
    if (resultsToConsider.length && weightages.length) {
      dayProgress = 0;
      for (let i = 0; i < numTasksForWeightage; i++) {
        const weight = weightages[i] ?? 0;
        dayProgress += (resultsToConsider[i] * weight) / 100;
      }
      dayProgress = Math.round(dayProgress);
    }

    await record.update({ tasks, dayProgress });

    return ReS(res, { success: true, date, tasks, dayProgress }, 200);

  } catch (error) {
    console.error("Error fetching task for date:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getTaskForDate = getTaskForDate;




