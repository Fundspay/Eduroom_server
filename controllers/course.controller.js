"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { uploadGeneralFile } = require("../middleware/s3.middleware.js");

var addCourse = async (req, res) => {
  uploadGeneralFile.fields([
    { name: "img", maxCount: 1 },
    { name: "img2", maxCount: 1 }
  ])(req, res, async function (err) {
    if (err) return ReE(res, err.message, 422);

    const {
      name,
      domainId,
      description,
      businessTarget,
      totalDays,
      duration,
      certificateCount,
      domainSkills,
      interpersonalSkills,
      managerName,
      managerPosition,
      followerTarget,
      reviewAndRatingTarget,
      postTarget,
      fundswebTarget,       // ✅ added
    } = req.body;

    if (!name) return ReE(res, "Course name is required", 400);
    if (!domainId) return ReE(res, "Domain ID is required", 400);

    try {
      const domain = await model.Domain.findByPk(domainId);
      if (!domain || domain.isDeleted) return ReE(res, "Domain not found", 404);

      const course = await model.Course.create({
        name,
        domainId,
        description: description || null,
        businessTarget: businessTarget || null,
        totalDays: totalDays || null,
        duration: duration || null,
        certificateCount: certificateCount || null,
        img: req.files?.img ? req.files.img[0].location : null,
        img2: req.files?.img2 ? req.files.img2[0].location : null,
        domainSkills: domainSkills || null,
        interpersonalSkills: interpersonalSkills || null,
        managerName: managerName || null,
        managerPosition: managerPosition || null,
        followerTarget: followerTarget ? Number(followerTarget) : null,
        reviewAndRatingTarget: reviewAndRatingTarget ? Number(reviewAndRatingTarget) : null,
        postTarget: postTarget ? Number(postTarget) : null,
        fundswebTarget: fundswebTarget ? Number(fundswebTarget) : null,   // ✅ added
      });

      return ReS(res, course, 201);
    } catch (error) {
      return ReE(res, error.message, 422);
    }
  });
};
module.exports.addCourse = addCourse;

var updateCourse = async (req, res) => {
  uploadGeneralFile.fields([
    { name: "img", maxCount: 1 },
    { name: "img2", maxCount: 1 }
  ])(req, res, async function (err) {
    if (err) return ReE(res, err.message, 422);

    try {
      const course = await model.Course.findByPk(req.params.id);
      if (!course) return ReE(res, "Course not found", 404);

      console.log("req.body:", req.body);
      console.log("fundswebTarget received:", req.body.fundswebTarget);

      const oldBusinessTarget = course.businessTarget;

      await course.update({
        name: req.body.name || course.name,
        domainId: req.body.domainId || course.domainId,
        description: req.body.description !== undefined ? req.body.description : course.description,
        businessTarget: req.body.businessTarget !== undefined ? req.body.businessTarget : course.businessTarget,
        totalDays: req.body.totalDays !== undefined ? req.body.totalDays : course.totalDays,
        duration: req.body.duration !== undefined ? req.body.duration : course.duration,
        certificateCount: req.body.certificateCount !== undefined ? req.body.certificateCount : course.certificateCount,
        img: req.files?.img ? req.files.img[0].location : course.img,
        img2: req.files?.img2 ? req.files.img2[0].location : course.img2,
        domainSkills: req.body.domainSkills !== undefined ? req.body.domainSkills : course.domainSkills,
        interpersonalSkills: req.body.interpersonalSkills !== undefined ? req.body.interpersonalSkills : course.interpersonalSkills,
        managerName: req.body.managerName !== undefined ? req.body.managerName : course.managerName,
        managerPosition: req.body.managerPosition !== undefined ? req.body.managerPosition : course.managerPosition,
        // ✅ Only these 3 fixed
        followerTarget: (req.body.followerTarget !== undefined && req.body.followerTarget !== "" && !isNaN(req.body.followerTarget)) ? Number(req.body.followerTarget) : course.followerTarget,
        reviewAndRatingTarget: (req.body.reviewAndRatingTarget !== undefined && req.body.reviewAndRatingTarget !== "" && !isNaN(req.body.reviewAndRatingTarget)) ? Number(req.body.reviewAndRatingTarget) : course.reviewAndRatingTarget,
        postTarget: (req.body.postTarget !== undefined && req.body.postTarget !== "" && !isNaN(req.body.postTarget)) ? Number(req.body.postTarget) : course.postTarget,
        fundswebTarget: (req.body.fundswebTarget !== undefined && req.body.fundswebTarget !== "" && !isNaN(req.body.fundswebTarget)) ? Number(req.body.fundswebTarget) : course.fundswebTarget,  // ✅ added
      });

      // -----------------------------------------------------
      //  UPDATE Users.businessTargets IF businessTarget CHANGED
      // -----------------------------------------------------
      if (req.body.businessTarget !== undefined && req.body.businessTarget !== oldBusinessTarget) {
        const newTarget = Number(req.body.businessTarget);
        const users = await model.User.findAll();

        let updatedUsersCount = 0;

        for (const user of users) {
          if (!user.businessTargets) continue;

          const bt = { ...user.businessTargets };

          if (bt[course.id]) {
            console.log(`➡ Updating User ID: ${user.id} for Course: ${course.id}`);
            console.log("   Old target:", bt[course.id].target, "| New target:", newTarget);

            bt[course.id].target = newTarget;
            user.businessTargets = bt;
            user.changed("businessTargets", true);

            await user.save({ fields: ["businessTargets"] });
            updatedUsersCount++;
          }
        }

        console.log(`🟢 Updated businessTargets for ${updatedUsersCount} users.`);
      } else {
        console.log("⚠ businessTarget not changed — skipping user updates.");
      }

      return ReS(res, course, 200);

    } catch (error) {
      console.error("❌ updateCourse error:", error);
      return ReE(res, error.message, 500);
    }
  });
};
module.exports.updateCourse = updateCourse;

var listCourses = async (req, res) => {
  try {
    const courses = await model.Course.findAll({
      where: { isDeleted: false },
      include: [
        {
          model: model.Domain,
          attributes: ["id", "name"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    return ReS(res, courses, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};
module.exports.listCourses = listCourses;

const fetchAllCourses = async (req, res) => {
  try {
    const { userId } = req.query;

    const userIdNum = Number(userId);
    if (!userId || isNaN(userIdNum) || !Number.isInteger(userIdNum) || userIdNum <= 0) {
      return ReE(res, "Valid userId is required", 400);
    }

    const user = await model.User.findByPk(userIdNum, {
      include: [
        {
          model: model.TeamManager,
          as: "teamManager",
          attributes: ["internshipStatus", "name", "email"],
        },
      ],
    });

    if (!user) return ReE(res, "User not found", 404);

    const courses = await model.Course.findAll({
      where: { isDeleted: false },
      attributes: { exclude: ["createdAt", "updatedAt"] },
      include: [{ model: model.Domain, attributes: ["name"] }],
    });

    const previews = await model.CoursePreview.findAll({
      where: { isDeleted: false },
      attributes: [
        ["id", "coursePreviewId"],
        "courseId",
        "domainId",
        "title",
        "heading",
        "dayCount",
      ],
      raw: true,
    });

    const coursesWithStatus = courses.map((course) => {
      let status = "Not Started";

      const courseDates = user.courseDates || {};
      const courseStatuses = user.courseStatuses || {};
      const courseIdStr = String(course.id);

      if (courseDates[courseIdStr] && courseDates[courseIdStr].started) {
        status = courseStatuses[courseIdStr] || "Started";
      }

      const coursePreviews = previews
        .filter((p) => p.courseId === course.id)
        .map((p) => ({
          coursePreviewId: p.coursePreviewId,
          dayCount: p.dayCount,
          title: p.title,
          heading: p.heading,
        }));

      // ✅ fundsweb targets per course
      const fundswebAchieved = user.fundswebTargets?.[courseIdStr] ?? null;
      const fundswebDeducted = user.fundswebDeductedTargets?.[courseIdStr] ?? null;
      const fundswebLeft = (fundswebAchieved !== null && fundswebDeducted !== null)
        ? Math.max(0, fundswebAchieved - fundswebDeducted)
        : null;

      return {
        ...course.toJSON(),
        courseId: course.id,
        CoursePreviews: coursePreviews,
        status,
        userCreatedAt: user.createdAt,
        // ✅ added
        fundswebAchieved,
        fundswebDeducted,
        fundswebLeft,
      };
    });

    return ReS(res, { success: true, data: coursesWithStatus }, 200);
  } catch (error) {
    console.error("Fetch All Courses Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchAllCourses = fetchAllCourses;

var fetchSingleCourse = async (req, res) => {
  const { id } = req.params;
  if (!id) return ReE(res, "Course ID is required", 400);

  try {
    const course = await model.Course.findByPk(id, {
      attributes: { exclude: ["createdAt", "updatedAt"] },
      include: [{ model: model.Domain, attributes: ["name"] }],
    });
    if (!course) return ReE(res, "Course not found", 404);
    return ReS(res, course, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchSingleCourse = fetchSingleCourse;

var deleteCourse = async (req, res) => {
  try {
    const course = await model.Course.findByPk(req.params.id);
    if (!course) return ReE(res, "Course not found", 404);

    await course.destroy();
    return ReS(res, { message: "Course deleted successfully" }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};
module.exports.deleteCourse = deleteCourse;


// ✅ Fetch all Courses by Domain ID
var fetchCoursesByDomain = async (req, res) => {
  const { domainId } = req.params;
  if (!domainId) return ReE(res, "Domain ID is required", 400);

  try {
    const domain = await model.Domain.findByPk(domainId);
    if (!domain || domain.isDeleted) return ReE(res, "Domain not found", 404);

    const courses = await model.Course.findAll({
      where: { domainId, isDeleted: false },
      attributes: { exclude: ["createdAt", "updatedAt"] },
      include: [{ model: model.Domain, attributes: ["name"] }],
    });

    return ReS(res, { success: true, data: courses }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchCoursesByDomain = fetchCoursesByDomain;

const getUserCourseStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return ReE(res, "userId is required", 400);

    // Fetch user
    const user = await model.User.findOne({
      where: { id: userId, isDeleted: false },
      attributes: [
        "id",
        "firstName",
        "lastName",
        "fullName",
        "subscriptionWallet",
        "subscriptiondeductedWallet",
        "courseStatuses",
        "courseDates"
      ]
    });

    if (!user) return ReE(res, "User not found", 404);

    const response = {
      userId: user.id,
      fullName: user.fullName || `${user.firstName} ${user.lastName}`,
      subscriptionWalletTotal: user.subscriptionWallet,
      subscriptionWalletRemaining: user.subscriptiondeductedWallet,
      courses: []
    };

    // Loop through all courses in courseStatuses
    for (const [courseId, status] of Object.entries(user.courseStatuses || {})) {
      const courseEndDate = user.courseDates?.[courseId]?.endDate || null;

      // Fetch course to check business target
      const course = await model.Course.findOne({ where: { id: courseId, isDeleted: false } });
      const businessTarget = course?.businessTarget || 0;

      // Determine if business target is achieved
      const businessTargetAchieved = (user.subscriptionWallet - user.subscriptiondeductedWallet) >= businessTarget;

      // Check internship certificate
      const internshipCertificate = await model.InternshipCertificate.findOne({
        where: { userId, courseId }
      });

      // Check offer letter
      const offerLetter = await model.OfferLetter.findOne({
        where: { userId }
      });

      response.courses.push({
        courseId,
        courseName: course?.name || null,
        courseStatus: status,
        courseEndDate,
        businessTarget,
        businessTargetAchieved,
        internshipCertificateSent: internshipCertificate ? internshipCertificate.isIssued : false,
        internshipCertificateUrl: internshipCertificate ? internshipCertificate.certificateUrl : null,
        offerLetterSent: offerLetter ? offerLetter.issent : false,
        offerLetterUrl: offerLetter ? offerLetter.fileUrl : null
      });
    }

    return ReS(res, { success: true, data: response }, 200);

  } catch (error) {
    console.error("getUserCourseStatus error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getUserCourseStatus = getUserCourseStatus;

const getAllUsersCourseStatus = async (req, res) => {
  try {
    // Fetch all users
    const users = await model.User.findAll({
      where: { isDeleted: false },
      attributes: [
        "id",
        "firstName",
        "lastName",
        "fullName",
        "subscriptionWallet",
        "subscriptiondeductedWallet",
        "courseStatuses",
        "courseDates"
      ]
    });

    if (!users || users.length === 0) {
      return ReE(res, "No users found", 404);
    }

    const response = [];

    for (const user of users) {
      const userData = {
        userId: user.id,
        fullName: user.fullName || `${user.firstName} ${user.lastName}`,
        subscriptionWalletTotal: user.subscriptionWallet,
        subscriptionWalletRemaining: user.subscriptiondeductedWallet,
        courses: []
      };

      // Loop through all courses in courseStatuses for this user
      for (const [courseId, status] of Object.entries(user.courseStatuses || {})) {
        const courseEndDate = user.courseDates?.[courseId]?.endDate || null;

        // Fetch course to check business target
        const course = await model.Course.findOne({
          where: { id: courseId, isDeleted: false }
        });
        const businessTarget = course?.businessTarget || 0;

        // ✅ Check if business target achieved (based on remaining balance)
        const businessTargetAchieved = user.subscriptiondeductedWallet >= businessTarget;

        // Check internship certificate
        const internshipCertificate = await model.InternshipCertificate.findOne({
          where: { userId: user.id, courseId }
        });

        // Check offer letter
        const offerLetter = await model.OfferLetter.findOne({
          where: { userId: user.id }
        });

        userData.courses.push({
          courseId,
          courseName: course?.name || null,
          courseStatus: status,
          courseEndDate,
          businessTarget,
          businessTargetAchieved,
          internshipCertificateSent: internshipCertificate ? internshipCertificate.isIssued : false,
          internshipCertificateUrl: internshipCertificate ? internshipCertificate.certificateUrl : null,
          offerLetterSent: offerLetter ? offerLetter.issent : false,
          offerLetterUrl: offerLetter ? offerLetter.fileUrl : null
        });
      }

      response.push(userData);
    }

    return ReS(res, { success: true, data: response }, 200);

  } catch (error) {
    console.error("getAllUsersCourseStatus error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getAllUsersCourseStatus = getAllUsersCourseStatus;

// ✅ For single user
const getUserWalletDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!userId) {
      return ReE(res, "userId is required", 400);
    }

    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      return ReE(res, "Invalid userId", 400);
    }

    // Fetch user
    const user = await model.User.findOne({
      where: { id: parsedUserId, isDeleted: false },
      attributes: [
        "id",
        "firstName",
        "lastName",
        "fullName",
        "subscriptionWallet",
        "subscriptiondeductedWallet",
        "courseStatuses",
        "businessTargets"
      ]
    });

    if (!user) return ReE(res, "User not found", 404);

    const courseDetails = [];

    for (const courseId of Object.keys(user.courseStatuses || {})) {
      const course = await model.Course.findOne({
        where: { id: courseId, isDeleted: false },
        attributes: ["id", "name", "businessTarget"]
      });

      const certificates = await model.InternshipCertificate.findAll({
        where: { userId: parsedUserId, courseId },
        attributes: ["deductedWallet"]
      });

      const deductedWallet = certificates.reduce(
        (sum, c) => sum + (parseInt(c.deductedWallet || 0, 10)),
        0
      );

      const userTarget = user.businessTargets?.[courseId];
      const rawTarget = parseInt(
        userTarget !== undefined ? userTarget : course?.businessTarget || 0,
        10
      );
      const businessTarget = rawTarget < 0 ? 0 : rawTarget;

      courseDetails.push({
        courseId,
        courseName: course?.name || null,
        businessTarget,
        deductedWallet
      });
    }

    const subscriptionWalletTotal = parseInt(user.subscriptionWallet || 0, 10);
    const subscriptiondeductedWallet = parseInt(user.subscriptiondeductedWallet || 0, 10);
    const subscriptionLeft = Math.max(0, subscriptionWalletTotal - subscriptiondeductedWallet);

    const response = {
      userId: user.id,
      fullName: user.fullName || `${user.firstName} ${user.lastName}`,
      subscriptionWalletTotal,
      subscriptiondeductedWallet,
      subscriptionLeft,
      courses: courseDetails
    };

    return ReS(res, { success: true, data: response }, 200);
  } catch (error) {
    console.error("getUserWalletDetails error:", error);
    return ReE(res, "Internal Server Error", 500);
  }
};

module.exports.getUserWalletDetails = getUserWalletDetails;

// ✅ For all users
const getAllUsersWalletDetails = async (req, res) => {
  try {
    const users = await model.User.findAll({
      where: { isDeleted: false },
      attributes: [
        "id",
        "firstName",
        "lastName",
        "fullName",
        "subscriptionWallet",
        "subscriptiondeductedWallet",
        "courseStatuses"
      ]
    });

    if (!users || users.length === 0) {
      return ReE(res, "No users found", 404);
    }

    const response = [];

    for (const user of users) {
      const courseDetails = [];

      for (const courseId of Object.keys(user.courseStatuses || {})) {
        // Fetch course
        const course = await model.Course.findOne({
          where: { id: courseId, isDeleted: false },
          attributes: ["id", "name", "businessTarget"]
        });

        // Sum deducted wallet from certificates for this course
        const certificates = await model.InternshipCertificate.findAll({
          where: { userId: user.id, courseId },
          attributes: ["deductedWallet"]
        });
        const deductedWallet = certificates.reduce(
          (sum, c) => sum + (c.deductedWallet || 0),
          0
        );

        courseDetails.push({
          courseId,
          courseName: course?.name || null,
          businessTarget: course?.businessTarget || 0,
          deductedWallet
        });
      }

      const subscriptionWalletTotal = user.subscriptionWallet || 0;
      const subscriptiondeductedWallet = user.subscriptiondeductedWallet || 0;
      const subscriptionLeft = subscriptionWalletTotal - subscriptiondeductedWallet;

      response.push({
        userId: user.id,
        fullName: user.fullName || `${user.firstName} ${user.lastName}`,
        subscriptionWalletTotal,
        subscriptiondeductedWallet,
        subscriptionLeft,
        courses: courseDetails
      });
    }

    return ReS(res, { success: true, data: response }, 200);
  } catch (error) {
    console.error("getAllUsersWalletDetails error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getAllUsersWalletDetails = getAllUsersWalletDetails;
