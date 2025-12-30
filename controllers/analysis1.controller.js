"use strict";
const model = require("../models");
const { ReE, ReS } = require("../utils/util.service");
const { Op } = require("sequelize");

var extractAndStoreCourseDates = async function (req, res) {
  try {
    // 1️⃣ Fetch ALL active users
    const users = await model.User.findAll({
      where: { isDeleted: false },
      attributes: ["id", "selected", "courseDates"]
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

      // 2️⃣ FIXED extraction logic
      if (
        user.courseDates &&
        typeof user.courseDates === "object" &&
        user.courseDates[String(user.selected)]
      ) {
        const selectedCourse = user.courseDates[String(user.selected)];

        course_id = user.selected; // ✅ course_id comes from selected
        course_name = selectedCourse.courseName || null;
        start_date = selectedCourse.startDate || null;
        end_date = selectedCourse.endDate || null;

        // 3️⃣ Fetch business task
        if (course_id) {
          const courseRecord = await model.Courses.findOne({
            where: { id: course_id },
            attributes: ["businessTarget"]
          });

          if (courseRecord) {
            business_task = courseRecord.businessTarget || 0;
          }
        }
      }

      // 4️⃣ Store / Update ALWAYS
      await model.analysis1.upsert({
        user_id: userId,
        course_id,
        course_name,
        start_date,
        end_date,
        business_task
      });

      // 5️⃣ Calculate days left (response only)
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
    const { id } = req.params;
    const { course_name, start_date, end_date, business_task } = req.body;

    if (!id) return ReE(res, "Record ID is required", 400);

    // Fetch existing record
    const record = await model.analysis1.findOne({ where: { id } });
    if (!record) return ReE(res, "Record not found", 404);

    // Update only the fields provided
    if (course_name !== undefined) record.course_name = course_name;
    if (start_date !== undefined) record.start_date = start_date;
    if (end_date !== undefined) record.end_date = end_date;
    if (business_task !== undefined) record.business_task = business_task;

    await record.save();

    // Calculate updated daysLeft
    const today = new Date();
    const endDate = new Date(record.end_date);
    const diffTime = endDate.setHours(0,0,0,0) - today.setHours(0,0,0,0);
    const daysLeft = Math.max(Math.floor(diffTime / (1000*60*60*24)), 0);

    return ReS(res, {
      success: true,
      message: "Record updated successfully",
      data: {
        id: record.id,
        user_id: record.user_id,
        course_id: record.course_id,
        course_name: record.course_name,
        start_date: record.start_date,
        end_date: record.end_date,
        business_task: record.business_task,
        daysLeft
      }
    }, 200);

  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.updateStoredCourse = updateStoredCourse;