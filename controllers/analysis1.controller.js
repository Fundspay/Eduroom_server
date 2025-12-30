"use strict";
const model = require("../models");
const { ReE, ReS } = require("../utils/util.service");
const { Op } = require("sequelize");

var extractAndStoreCourseDates = async function (req, res) {
  try {
    const users = await model.User.findAll({
      where: { isDeleted: false },
      attributes: ["id", "courseDates", "businessTargets"]
    });

    let processed = 0;
    const responseData = [];

    for (const user of users) {
      const userId = user.id;

      let course_id = null;
      let course_name = null;
      let start_date = null;
      let end_date = null;
      let business_task = 0;

      if (
        user.courseDates &&
        typeof user.courseDates === "object" &&
        Object.keys(user.courseDates).length > 0
      ) {
        // 🔥 SAME AS SQL json_each
        const firstCourseKey = Object.keys(user.courseDates)[0];
        const courseData = user.courseDates[firstCourseKey];

        course_id = parseInt(firstCourseKey);
        course_name = courseData.courseName || null;
        start_date = courseData.startDate || null;
        end_date = courseData.endDate || null;

        // 🔥 Business task from Users.businessTargets
        if (
          user.businessTargets &&
          user.businessTargets[firstCourseKey] &&
          user.businessTargets[firstCourseKey].target
        ) {
          business_task = user.businessTargets[firstCourseKey].target;
        }
      }

      await model.analysis1.upsert({
        user_id: userId,
        course_id,
        course_name,
        start_date,
        end_date,
        business_task
      });

      let daysLeft = null;
      if (end_date) {
        const today = new Date();
        const end = new Date(end_date);

        const diff =
          end.setHours(0, 0, 0, 0) -
          today.setHours(0, 0, 0, 0);

        daysLeft = Math.max(
          Math.floor(diff / (1000 * 60 * 60 * 24)),
          0
        );
      }

      responseData.push({
        user_id: userId,
        course_id,
        course_name,
        start_date,
        end_date,
        daysLeft,
        business_task
      });

      processed++;
    }

    return ReS(res, {
      success: true,
      message: "User course data synced successfully",
      recordsProcessed: processed,
      data: responseData
    }, 200);

  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.extractAndStoreCourseDates = extractAndStoreCourseDates;



var fetchAllStoredCourses = async function (req, res) {
  try {
    // Fetch all stored selected courses
    const courses = await model.analysis1.findAll({
      attributes: ["user_id", "course_id", "course_name", "start_date", "end_date", "business_task"],
      order: [["user_id", "ASC"]]
    });

    const today = new Date();

    // Add daysLeft dynamically
    const coursesWithDaysLeft = courses.map(c => {
      const endDate = new Date(c.end_date);
      const diffTime = endDate.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
      const daysLeft = Math.max(Math.floor(diffTime / (1000 * 60 * 60 * 24)), 0);

      return {
        user_id: c.user_id,
        course_id: c.course_id,
        course_name: c.course_name,
        start_date: c.start_date,
        end_date: c.end_date,
        daysLeft,
        business_task: c.business_task
      };
    });

    return ReS(res, {
      success: true,
      message: "All stored selected course data fetched successfully",
      totalRecords: coursesWithDaysLeft.length,
      data: coursesWithDaysLeft
    }, 200);

  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchAllStoredCourses = fetchAllStoredCourses;

var fetchStoredCoursesByUser = async function (req, res) {
  try {
    const { userId } = req.params;

    if (!userId) return ReE(res, "userId is required", 400);

    // Fetch courses for the specific user
    const courses = await model.analysis1.findAll({
      where: { user_id: userId },
      attributes: ["user_id", "course_id", "course_name", "start_date", "end_date", "business_task"],
      order: [["start_date", "ASC"]]
    });

    if (!courses.length) {
      return ReS(res, {
        success: true,
        message: `No selected courses found for user ${userId}`,
        totalRecords: 0,
        data: []
      }, 200);
    }

    const today = new Date();

    // Add daysLeft dynamically
    const coursesWithDaysLeft = courses.map(c => {
      const endDate = new Date(c.end_date);
      const diffTime = endDate.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
      const daysLeft = Math.max(Math.floor(diffTime / (1000 * 60 * 60 * 24)), 0);

      return {
        user_id: c.user_id,
        course_id: c.course_id,
        course_name: c.course_name,
        start_date: c.start_date,
        end_date: c.end_date,
        daysLeft,
        business_task: c.business_task
      };
    });

    return ReS(res, {
      success: true,
      message: `Selected course data fetched for user ${userId}`,
      totalRecords: coursesWithDaysLeft.length,
      data: coursesWithDaysLeft
    }, 200);

  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchStoredCoursesByUser = fetchStoredCoursesByUser;


var updateStoredCourse = async function (req, res) {
  try {
    const { userId } = req.params;
    const { course_name, start_date, end_date, business_task } = req.body;

    if (!userId) return ReE(res, "User ID is required", 400);

    // Fetch existing record by user_id
    const record = await model.analysis1.findOne({
      where: { user_id: userId }
    });

    if (!record) return ReE(res, "Record not found for this user", 404);

    // Update only provided fields
    if (course_name !== undefined) record.course_name = course_name;
    if (start_date !== undefined) record.start_date = start_date;
    if (end_date !== undefined) record.end_date = end_date;
    if (business_task !== undefined) record.business_task = business_task;

    await record.save();

    // Calculate updated daysLeft
    const today = new Date();
    let daysLeft = null;

    if (record.end_date) {
      const endDate = new Date(record.end_date);
      const diffTime =
        endDate.setHours(0, 0, 0, 0) -
        today.setHours(0, 0, 0, 0);

      daysLeft = Math.max(
        Math.floor(diffTime / (1000 * 60 * 60 * 24)),
        0
      );
    }

    return ReS(
      res,
      {
        success: true,
        message: "Record updated successfully",
        data: {
          user_id: record.user_id,
          course_id: record.course_id,
          course_name: record.course_name,
          start_date: record.start_date,
          end_date: record.end_date,
          business_task: record.business_task,
          daysLeft
        }
      },
      200
    );
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.updateStoredCourse = updateStoredCourse;

var getUserAnalysis = async function (req, res) {
  try {
    const { userId } = req.params;
    if (!userId) return ReE(res, "User ID is required", 400);

    // Fetch the user's course info
    const record = await model.analysis1.findOne({
      where: { user_id: userId }
    });

    if (!record) return ReE(res, "Record not found", 404);

    const { start_date, end_date, business_task } = record;

    // ✅ Fetch BUSINESS_TASK from User table (subscriptionLeft + subscriptiondeductedWallet)
    const user = await model.User.findOne({
      where: { id: userId },
      attributes: ["subscriptionLeft", "subscriptiondeductedWallet"]
    });

    const businessTaskValue =
      (parseInt(user?.subscriptionLeft || 0, 10) +
        parseInt(user?.subscriptiondeductedWallet || 0, 10)) || 0;

    // DAILY_TARGET calculation stays the same (based on analysis1.business_task)
    const taskValue = business_task || 0;
    const percentageDistribution = [18, 22, 25, 25, 10];
    const dailyTargets = percentageDistribution.map(p => Math.round((p / 100) * taskValue));
    const defaultTargets = [25, 35, 45, 55, 65];

    // Category for each day
    const categoryDistribution = [
      "OFFER LETTER",
      "BRONZE",
      "SILVER",
      "GOLD",
      "DIAMOND",
      "LOA",
      "1500 STIPEND",
      "2500 STIPEND",
      "3500 STIPEND",
      "5000 STIPEND"
    ];

    const data = [];
    const totalDays = 10;

    for (let i = 0; i < totalDays; i++) {
      let dateDay = "Date not available";

      if (start_date) {
        const currentDate = new Date(start_date);
        currentDate.setDate(currentDate.getDate() + i);
        const options = { day: "numeric", month: "short", weekday: "long" };
        dateDay = currentDate.toLocaleDateString("en-US", options);
      }

      data.push({
        SR: i + 1,
        DAY_OF_WORK: `DAY ${i + 1}`,
        DATE_DAY: dateDay,
        WORK_STATUS: "Not Completed", // default
        COMMENT: "",
        BUSINESS_TASK: businessTaskValue, // ✅ from User table
        DAILY_TARGET: i < 5 ? dailyTargets[i] || 0 : defaultTargets[i - 5],
        PERCENT_OF_WORK: "0.00%", // default
        CATEGORY: categoryDistribution[i] || ""
      });
    }

    return ReS(res, { success: true, data }, 200);
  } catch (err) {
    return ReE(res, err.message, 500);
  }
};

module.exports.getUserAnalysis = getUserAnalysis;




var upsertUserDayWork = async function(req, res) {
  try {
    const { user_id, day_no } = req.body;
    const { work_status, comment, daily_target } = req.body;

    if (!user_id || !day_no) return ReE(res, "User ID and Day No are required", 400);

    // Find existing record
    let record = await model.analysis1.findOne({ where: { user_id, day_no } });

    if (!record) {
      // Create new row if not exists
      record = await model.analysis1.create({
        user_id,
        day_no,
        work_status: work_status || 0,
        comment: comment || null,
        daily_target: daily_target || 0
      });
    } else {
      // Update existing
      if (work_status !== undefined) record.work_status = work_status;
      if (comment !== undefined) record.comment = comment;
      if (daily_target !== undefined) record.daily_target = daily_target;
      await record.save();
    }

    return ReS(res, { success: true, data: record }, 200);

  } catch (err) {
    return ReE(res, err.message, 500);
  }
};

module.exports.upsertUserDayWork = upsertUserDayWork;

