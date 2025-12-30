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
        const firstCourseKey = Object.keys(user.courseDates)[0];
        const courseData = user.courseDates[firstCourseKey];

        course_id = firstCourseKey ? parseInt(firstCourseKey) : null;
        course_name = courseData?.courseName || null;
        start_date = courseData?.startDate || null;
        end_date = courseData?.endDate || null;

        if (
          user.businessTargets &&
          user.businessTargets[firstCourseKey] &&
          user.businessTargets[firstCourseKey].target
        ) {
          business_task = user.businessTargets[firstCourseKey].target;
        }
      }

      // 🔹 Check if row exists first
      const existingRecord = await model.analysis1.findOne({
        where: { user_id: userId, day_no: 1 }
      });

      if (existingRecord) {
        // Update existing record
        await model.analysis1.update(
          {
            course_id,
            course_name,
            start_date,
            end_date,
            business_task,
            work_status: "Not Completed",
            comment: ""
          },
          { where: { user_id: userId, day_no: 1 } }
        );
      }
      // If no record exists, do NOT insert anything (skip)

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
      message: "User course data synced successfully (only updated existing records)",
      recordsProcessed: processed,
      data: responseData
    }, 200);

  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.extractAndStoreCourseDates = extractAndStoreCourseDates;


var fetchStoredCoursesByUser = async function (req, res) {
  try {
    const { userId } = req.params;

    if (!userId) return ReE(res, "userId is required", 400);

    // Fetch courses from analysis1
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

    // Fetch user info (achieved business task + business targets)
    const user = await model.User.findOne({
      where: { id: userId },
      attributes: ["subscriptionWallet", "businessTargets"]
    });

    const achievedBusinessTask = parseInt(user?.subscriptionWallet || 0, 10) || 0;

    // Fetch day-wise analysis data
    const analysisDays = await model.analysis1.findAll({
      where: { user_id: userId },
      order: [["day_no", "ASC"]]
    });

    // Find last completed day (100%)
    let currentCategory = null;
    for (const day of analysisDays) {
      if (day.daily_target > 0 && achievedBusinessTask >= day.daily_target) {
        currentCategory = day.category;
      } else {
        break;
      }
    }

    const today = new Date();

    const coursesWithDaysLeft = courses.map(c => {
      const endDate = c.end_date ? new Date(c.end_date) : null;
      const diffTime = endDate
        ? endDate.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)
        : 0;

      const daysLeft = endDate
        ? Math.max(Math.floor(diffTime / (1000 * 60 * 60 * 24)), 0)
        : null;

      // Use business_task from analysis1 first, fallback to User.businessTargets
      const business_task = c.business_task !== undefined && c.business_task !== null
        ? c.business_task
        : user.businessTargets?.[c.course_id]?.target || 0;

      return {
        user_id: c.user_id,
        course_id: c.course_id,
        course_name: c.course_name,
        start_date: c.start_date,
        end_date: c.end_date,
        daysLeft,
        business_task,
        achieved_business_task: achievedBusinessTask,
        current_category: currentCategory
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

    const record = await model.analysis1.findOne({
      where: { user_id: userId }
    });

    if (!record) return ReE(res, "Record not found", 404);

    const { start_date, end_date, business_task, course_id, course_name } = record;

    const user = await model.User.findOne({
      where: { id: userId },
      attributes: ["subscriptionLeft", "subscriptiondeductedWallet","subscriptionWallet"]
    });

    const businessTaskValue =
      parseInt(user?.subscriptionWallet || 0, 10) || 0;

    const businessTaskText = String(businessTaskValue);

    const taskValue = parseInt(business_task || 0, 10);
    const percentageDistribution = [18, 22, 25, 25, 10];
    const dailyTargets = percentageDistribution.map(p =>
      Math.round((p / 100) * taskValue)
    );
    const defaultTargets = [25, 35, 45, 55, 65];

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

    const totalDays = 10;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const data = [];

    for (let i = 0; i < totalDays; i++) {
      let dateDay = "Date not available";
      let currentDate = null;

      if (start_date) {
        currentDate = new Date(start_date);
        currentDate.setDate(currentDate.getDate() + i);
        const options = { day: "numeric", month: "short", weekday: "long" };
        dateDay = currentDate.toLocaleDateString("en-US", options);
      }

      const dailyTarget =
        i < 5 ? dailyTargets[i] || 0 : defaultTargets[i - 5];

      let percentOfWork = "0.00%";

      if (currentDate && currentDate <= today) {
        const achieved = Math.min(dailyTarget, businessTaskValue);
        percentOfWork =
          dailyTarget > 0
            ? ((achieved / dailyTarget) * 100).toFixed(2) + "%"
            : "0.00%";
      }

      //  Preserve existing work_status and comment
      const existingDay = await model.analysis1.findOne({
        where: { user_id: userId, day_no: i + 1 }
      });

      const workStatus = existingDay?.work_status || "Not Completed";
      const comment = existingDay?.comment || "";

      await model.analysis1.upsert({
        user_id: userId,
        day_no: i + 1,
        course_id: course_id || null,
        course_name: course_name || null,
        start_date: start_date || null,
        end_date: end_date || null,
        daily_target: dailyTarget,
        business_task: businessTaskText,
        percent_of_work: percentOfWork,
        category: categoryDistribution[i],
        work_status: workStatus,
        comment: comment
      });

      data.push({
        SR: i + 1,
        DAY_OF_WORK: `DAY ${i + 1}`,
        DATE_DAY: dateDay,
        WORK_STATUS: workStatus,
        COMMENT: comment,
        BUSINESS_TASK: businessTaskText,
        DAILY_TARGET: dailyTarget,
        PERCENT_OF_WORK: percentOfWork,
        CATEGORY: categoryDistribution[i]
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
    const { user_id, day_no, work_status, comment, daily_target } = req.body;

    if (!user_id || !day_no) return ReE(res, "User ID and Day No are required", 400);

    // Find existing record
    let record = await model.analysis1.findOne({ where: { user_id, day_no } });

    if (!record) {
      // Create new row if not exists
      record = await model.analysis1.create({
        user_id,
        day_no,
        work_status: work_status || "Not Completed",
        comment: comment || null,
        daily_target: daily_target || 0
      });
    } else {
      // Update existing record
      if (work_status !== undefined) record.work_status = work_status;
      if (comment !== undefined) record.comment = comment;
      if (daily_target !== undefined) record.daily_target = daily_target;
      await record.save();
    }

    // Fetch BUSINESS_TASK from User table
    const user = await model.User.findOne({
      where: { id: user_id },
      attributes: ["subscriptionLeft", "subscriptiondeductedWallet"]
    });

    const businessTaskValue =
      (parseInt(user?.subscriptionLeft || 0, 10) +
       parseInt(user?.subscriptiondeductedWallet || 0, 10)) || 0;

    // Include BUSINESS_TASK in response
    const responseData = {
      ...record.toJSON(),
      BUSINESS_TASK: businessTaskValue
    };

    return ReS(res, { success: true, data: responseData }, 200);

  } catch (err) {
    return ReE(res, err.message, 500);
  }
};

module.exports.upsertUserDayWork = upsertUserDayWork;



