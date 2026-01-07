"use strict";

const model = require("../models");
const { ReE, ReS } = require("../utils/util.service");
const { Op } = require("sequelize");

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
var upsertTaskForDay = async function (req, res) {
  try {
    const { managerId, date, task } = req.body;

    if (!managerId || !date || !task) {
      return ReE(res, "managerId, date and task are required", 400);
    }

    // Find or create day row
    const [dayRecord] = await model.TaskCalendarDay.findOrCreate({
      where: {
        teamManagerId: managerId,
        taskDate: date,
      },
      defaults: {
        tasks: [],
        dayProgress: null,
      },
    });

    let tasks = Array.isArray(dayRecord.tasks)
      ? [...dayRecord.tasks]
      : [];

    // ---------------- ADD TASK ----------------
    if (!task.taskId) {
      if (!task.taskType || !task.title) {
        return ReE(res, "taskType and title are required to add task", 400);
      }

      const newTask = {
        taskId: getNextTaskId(tasks),
        taskType: task.taskType,
        title: task.title,
        mode: task.mode || "MANUAL",
        progress: task.progress ?? null,
        status: task.status || "NORMAL",
        order: tasks.length + 1,
      };

      tasks.push(newTask);
    }

    // ---------------- UPDATE TASK ----------------
    if (task.taskId) {
      const index = tasks.findIndex(t => t.taskId === task.taskId);

      if (index === -1) {
        return ReE(res, "Task not found for update", 404);
      }

      // Update ONLY provided fields
      tasks[index] = {
        ...tasks[index],
        ...Object.fromEntries(
          Object.entries(task).filter(
            ([key]) => key !== "taskId"
          )
        ),
      };
    }

    // ---------------- DAY PROGRESS ----------------
    const validProgress = tasks
      .map(t => t.progress)
      .filter(p => p !== null && p !== undefined);

    const dayProgress =
      validProgress.length > 0
        ? Math.round(
            validProgress.reduce((a, b) => a + b, 0) /
              validProgress.length
          )
        : null;

    await dayRecord.update({
      tasks,
      dayProgress,
    });

    return ReS(
      res,
      {
        success: true,
        date,
        tasks,
        dayProgress,
      },
      200
    );
  } catch (error) {
    console.error("Error upserting task:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.upsertTaskForDay = upsertTaskForDay;