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

        // NEW LOGIC: derive end_date from start_date (+4 days)
        if (start_date) {
          const start = new Date(start_date);
          const derivedEnd = new Date(start);
          derivedEnd.setDate(start.getDate() + 4); // total 5 days window
          end_date = derivedEnd;
        } else {
          end_date = null;
        }

        if (
          user.businessTargets &&
          user.businessTargets[firstCourseKey] &&
          user.businessTargets[firstCourseKey].target
        ) {
          business_task = user.businessTargets[firstCourseKey].target;
        }
      }

      const existingRecord = await model.analysis1.findOne({
        where: { user_id: userId, day_no: 1 }
      });

      if (existingRecord) {
        await model.analysis1.update(
          {
            course_id,
            course_name,
            start_date,
            end_date,
            business_task
          },
          { where: { user_id: userId } }
        );
      } else {
        await model.analysis1.create({
          user_id: userId,
          day_no: 1,
          course_id,
          course_name,
          start_date,
          end_date,
          business_task,
          work_status: "Not Completed",
          comment: ""
        });
      }

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

    return ReS(
      res,
      {
        success: true,
        message: "User course data synced successfully",
        recordsProcessed: processed,
        data: responseData
      },
      200
    );
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

    // Find business_task for each course/user combination
    const taskMap = {};
    courses.forEach(c => {
      const key = `${c.user_id}_${c.course_id}`;
      if (c.business_task !== undefined && c.business_task !== null) {
        taskMap[key] = Number(c.business_task);
      }
    });

    // Add daysLeft dynamically and populate business_task for all records
    const coursesWithDaysLeft = courses.map(c => {
      let daysLeft = null;
      if (c.end_date) {
        const endDate = new Date(c.end_date);
        const diffTime = endDate.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
        daysLeft = Math.max(Math.floor(diffTime / (1000 * 60 * 60 * 24)), 0);
      }

      const key = `${c.user_id}_${c.course_id}`;
      return {
        user_id: c.user_id,
        course_id: c.course_id,
        course_name: c.course_name,
        start_date: c.start_date,
        end_date: c.end_date,
        daysLeft,
        business_task: taskMap[key] || 0
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

    const courses = await model.analysis1.findAll({
      where: { user_id: userId },
      attributes: ["user_id", "course_id", "course_name", "start_date", "end_date", "business_task"],
      order: [["start_date", "ASC"]]
    });

    if (!courses.length) {
      return ReS(
        res,
        {
          success: true,
          message: `No selected courses found for user ${userId}`,
          totalRecords: 0,
          data: []
        },
        200
      );
    }

    const user = await model.User.findOne({
      where: { id: userId },
      attributes: ["subscriptionWallet"]
    });

    const achievedBusinessTask = parseInt(user?.subscriptionWallet || 0, 10) || 0;

    // Fetch day-wise analysis data
    const analysisDays = await model.analysis1.findAll({
      where: { user_id: userId },
      order: [["day_no", "ASC"]]
    });

    // Find last completed day (existing logic)
    let currentCategory = null;
    for (const day of analysisDays) {
      if (day.daily_target > 0 && achievedBusinessTask >= day.daily_target) {
        currentCategory = day.category;
      } else {
        break;
      }
    }

    //  NEW: WORK STATUS PERCENTAGE CALCULATION
    const totalDays = 10;
    let workStatusTotal = 0;

    for (const day of analysisDays) {
      if (day.work_status === "Completed") workStatusTotal += 100;
      else if (day.work_status === "In Progress") workStatusTotal += 33;
      else if (day.work_status === "Not Completed") workStatusTotal += 0;
    }

    const workStatusPercentage = Number(
      (workStatusTotal / totalDays).toFixed(2)
    );

    const today = new Date();

    // Create a map to ensure business_task is consistent across all records
    const taskMap = {};
    courses.forEach(c => {
      const key = `${c.user_id}_${c.course_id}`;
      if (c.business_task !== null && c.business_task !== undefined) {
        taskMap[key] = Number(c.business_task);
      }
    });

    const coursesWithDaysLeft = courses.map(c => {
      const endDate = c.end_date ? new Date(c.end_date) : null;
      const diffTime = endDate
        ? endDate.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)
        : 0;

      const daysLeft = endDate
        ? Math.max(Math.floor(diffTime / (1000 * 60 * 60 * 24)), 0)
        : null;

      const key = `${c.user_id}_${c.course_id}`;

      return {
        user_id: c.user_id,
        course_id: c.course_id,
        course_name: c.course_name,
        start_date: c.start_date,
        end_date: c.end_date,
        daysLeft,
        business_task: taskMap[key] || 0,
        achieved_business_task: achievedBusinessTask,
        current_category: currentCategory,
        work_status_percentage: workStatusPercentage
      };
    });

    return ReS(
      res,
      {
        success: true,
        message: `Selected course data fetched for user ${userId}`,
        totalRecords: coursesWithDaysLeft.length,
        data: coursesWithDaysLeft
      },
      200
    );
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

    // Fetch all records for the user
    const records = await model.analysis1.findAll({
      where: { user_id: userId }
    });

    if (!records.length) return ReE(res, "No records found for this user", 404);

    // Update only provided fields in all records
    for (const record of records) {
      if (course_name !== undefined) record.course_name = course_name;
      if (start_date !== undefined) record.start_date = start_date;
      if (end_date !== undefined) record.end_date = end_date;
      if (business_task !== undefined) record.business_task = business_task;
      await record.save();
    }

    // Calculate updated daysLeft using the first record (all records have same dates now)
    const today = new Date();
    let daysLeft = null;

    if (records[0].end_date) {
      const endDate = new Date(records[0].end_date);
      const diffTime =
        endDate.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);

      daysLeft = Math.max(Math.floor(diffTime / (1000 * 60 * 60 * 24)), 0);
    }

    return ReS(
      res,
      {
        success: true,
        message: "Records updated successfully",
        data: {
          user_id: userId,
          course_id: records[0].course_id,
          course_name: course_name,
          start_date: start_date,
          end_date: end_date,
          business_task,
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

    const { start_date, business_task, course_id, course_name } = record;

    let calculatedEndDate = null;
    if (start_date) {
      calculatedEndDate = new Date(start_date);
      calculatedEndDate.setDate(calculatedEndDate.getDate() + 4);
      calculatedEndDate.setHours(0, 0, 0, 0);
    }

    const user = await model.User.findOne({
      where: { id: userId },
      attributes: ["subscriptionWallet"]
    });

    const achievedBusinessTask =
      parseInt(user?.subscriptionWallet || 0, 10) || 0;

    const taskValue =
      business_task !== null && business_task !== undefined
        ? parseInt(business_task, 10)
        : 0;

    const businessTaskText = String(taskValue);

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
      "LETTER OF APPRECIATION (LOA)",
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
        currentDate.setHours(0, 0, 0, 0);

        const options = { day: "numeric", month: "short", weekday: "long" };
        dateDay = currentDate.toLocaleDateString("en-US", options);
      }

      const dailyTarget =
        i < 5
          ? [...Array(i + 1)].reduce((sum, _, idx) => {
              return sum + (dailyTargets[idx] || 0);
            }, 0)
          : defaultTargets[i - 5];

      let percentOfWork = "0.00%";

      if (currentDate && currentDate <= today) {
        const achieved = Math.min(dailyTarget, achievedBusinessTask);
        percentOfWork =
          dailyTarget > 0
            ? ((achieved / dailyTarget) * 100).toFixed(2) + "%"
            : "0.00%";
      }

      const existingDay = await model.analysis1.findOne({
        where: { user_id: userId, day_no: i + 1 }
      });

      const workStatus = existingDay?.work_status || "Not Completed";
      const comment = existingDay?.comment || "";

      let workStatusPercentage = 0;
      if (workStatus === "Completed") workStatusPercentage = 100;
      else if (workStatus === "In Progress") workStatusPercentage = 33;

      let colorPercentage = null;
      if (currentDate && currentDate <= today) {
        const numericPercentOfWork = parseFloat(percentOfWork) || 0;
        colorPercentage = Number(
          (workStatusPercentage * 0.2 + numericPercentOfWork * 0.8).toFixed(2)
        );
      }

      //  FIX: Only create if not exists (NO OVERWRITE)
      if (!existingDay) {
        await model.analysis1.create({
          user_id: userId,
          day_no: i + 1,
          course_id: course_id || null,
          course_name: course_name || null,
          start_date: start_date || null,
          end_date: calculatedEndDate || null,
          daily_target: dailyTarget,
          percent_of_work: percentOfWork,
          category: categoryDistribution[i],
          work_status: "Not Completed",
          comment: ""
        });
      }

      data.push({
        SR: i + 1,
        DAY_OF_WORK: `DAY ${i + 1}`,
        DATE_DAY: dateDay,
        WORK_STATUS: workStatus,
        COMMENT: comment,
        BUSINESS_TASK: businessTaskText,
        ACHIEVED_BUSINESS_TASK: achievedBusinessTask,
        DAILY_TARGET: dailyTarget,
        PERCENT_OF_WORK: percentOfWork,
        COLOR_PERCENTAGE: colorPercentage,
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



