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

const defaultModeByTaskType = {
  "HR [COLLEGE CONNECT]": "SYSTEM",
  "HR [JD SEND]": "SYSTEM",
  "HR [FOLLOW UP]": "SYSTEM",
  "HR [RESUME RECEVIED]": "SYSTEM",
  "HR [SELECTED-COLLEGES]": "SYSTEM",
  "HR [SELECTION]": "SYSTEM",

  "BD [INTERNS ALLOCATED]": "SYSTEM",
  "BD [INTERNS ACTIVE]": "SYSTEM",
  "BD [ACCOUNTS]": "SYSTEM",

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
  1: [100],
  2: [70, 30],
  3: [70, 30, 0],
  4: [60, 30, 10, 0],
  5: [50, 20, 15, 10, 5],
  6: [40, 20, 15, 10, 10, 5],
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

    const deriveMode = (taskType) =>
      defaultModeByTaskType[taskType] === "SYSTEM" ? "SYSTEM" : "MANUAL";

    // ---------------- ADD TASK ----------------
    if (!task.taskId) {
      const mode = deriveMode(task.taskType);

      const newTask = {
        taskId: getNextTaskId(tasks),
        taskType: task.taskType || null,
        title: task.title,
        mode,
        status: task.status || "NORMAL",
        order: tasks.length + 1,
      };

      if (mode === "SYSTEM" && newTask.taskType) {
        const { calculateSystemTaskProgress } = require("./tasktype.controller");
        const r = await calculateSystemTaskProgress({
          taskType: newTask.taskType,
          managerId,
          date,
        });

        const achieved = r.achieved ?? 0;
        const target = r.target ?? 0;

        newTask.achieved = achieved;
        newTask.target = target;
        newTask.progress = `${achieved}/${target}`;
        newTask.result = target > 0 ? Math.round((achieved / target) * 100) : 0;
      } else {
        newTask.progress = "0";
        newTask.result = 0;
      }

      tasks.push(newTask);
    }

    // ---------------- UPDATE TASK ----------------
    if (task.taskId) {
      const index = tasks.findIndex(t => t.taskId === task.taskId);
      if (index === -1) return ReE(res, "Task not found for update", 404);

      const updatedTaskType = task.taskType || tasks[index].taskType;
      const mode = deriveMode(updatedTaskType);

      tasks[index] = {
        ...tasks[index],
        ...Object.fromEntries(Object.entries(task).filter(([k]) => k !== "taskId")),
        taskType: updatedTaskType,
        mode,
      };

      // -------- SYSTEM TASK --------
      if (mode === "SYSTEM" && tasks[index].taskType) {
        const { calculateSystemTaskProgress } = require("./tasktype.controller");
        const r = await calculateSystemTaskProgress({
          taskType: tasks[index].taskType,
          managerId,
          date,
        });

        const achieved = r.achieved ?? 0;
        const target = r.target ?? 0;

        tasks[index].achieved = achieved;
        tasks[index].target = target;
        tasks[index].progress = `${achieved}/${target}`;
        tasks[index].result = target > 0 ? Math.round((achieved / target) * 100) : 0;
      }

      // -------- MANUAL TASK --------
      if (mode === "MANUAL") {
        delete tasks[index].achieved;
        delete tasks[index].target;

        const progress =
          task.progress !== undefined
            ? task.progress
            : typeof tasks[index].progress === "string" && tasks[index].progress.includes("/")
              ? "0"
              : tasks[index].progress ?? "0";

        tasks[index].progress = progress;
        const val = parseFloat(progress);
        tasks[index].result = isNaN(val) ? 0 : val;
      }
    }

    // ---------------- DAY PROGRESS ----------------
    const validResults = tasks.map(t => t.result).filter(r => r !== null && r !== undefined);
    const resultsToConsider = validResults.slice(0, 6);
    const weightages = taskWeightageRules[resultsToConsider.length] || [];

    let dayProgress = null;
    if (resultsToConsider.length) {
      dayProgress = 0;
      for (let i = 0; i < resultsToConsider.length; i++) {
        dayProgress += (resultsToConsider[i] * (weightages[i] || 0)) / 100;
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
      const mode = defaultModeByTaskType[tasks[i].taskType] === "SYSTEM" ? "SYSTEM" : "MANUAL";
      tasks[i].mode = mode;

      if (mode === "SYSTEM" && tasks[i].taskType) {
        const r = await calculateSystemTaskProgress({
          taskType: tasks[i].taskType,
          managerId,
          date,
        });

        const achieved = r.achieved ?? 0;
        const target = r.target ?? 0;

        tasks[i].achieved = achieved;
        tasks[i].target = target;
        tasks[i].progress = `${achieved}/${target}`;
        tasks[i].result = target > 0 ? Math.round((achieved / target) * 100) : 0;
      }

      if (mode === "MANUAL") {
        delete tasks[i].achieved;
        delete tasks[i].target;

        const val = parseFloat(tasks[i].progress);
        tasks[i].result = isNaN(val) ? 0 : val;
        tasks[i].progress = tasks[i].progress ?? "0";
      }
    }

    const validResults = tasks.map(t => t.result).filter(r => r !== null && r !== undefined);
    const resultsToConsider = validResults.slice(0, 6);
    const weightages = taskWeightageRules[resultsToConsider.length] || [];

    let dayProgress = null;
    if (resultsToConsider.length) {
      dayProgress = 0;
      for (let i = 0; i < resultsToConsider.length; i++) {
        dayProgress += (resultsToConsider[i] * (weightages[i] || 0)) / 100;
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






