"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { uploadGeneralFile } = require("../middleware/s3.middleware.js"); // adjust path if needed

// ✅ Add a new Course with optional image upload
var addCourse = async (req, res) => {
    uploadGeneralFile.single("img")(req, res, async function (err) {
        if (err) return ReE(res, err.message, 422);

        const { name, domainId, description, businessTarget, totalDays, duration, certificateCount } = req.body;
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
                img: req.file ? req.file.location : null, // S3 URL
            });

            return ReS(res, course, 201);
        } catch (error) {
            return ReE(res, error.message, 422);
        }
    });
};
module.exports.addCourse = addCourse;

// ✅ Update Course with optional image upload
var updateCourse = async (req, res) => {
    uploadGeneralFile.single("img")(req, res, async function (err) {
        if (err) return ReE(res, err.message, 422);

        try {
            const course = await model.Course.findByPk(req.params.id);
            if (!course) return ReE(res, "Course not found", 404);

            await course.update({
                name: req.body.name || course.name,
                domainId: req.body.domainId || course.domainId,
                description: req.body.description !== undefined ? req.body.description : course.description,
                businessTarget: req.body.businessTarget !== undefined ? req.body.businessTarget : course.businessTarget,
                totalDays: req.body.totalDays !== undefined ? req.body.totalDays : course.totalDays,
                duration: req.body.duration !== undefined ? req.body.duration : course.duration,
                img: req.file ? req.file.location : course.img, // update image if uploaded
            });

            return ReS(res, course, 200);
        } catch (error) {
            return ReE(res, error.message, 500);
        }
    });
};
module.exports.updateCourse = updateCourse;

// ✅ Fetch all Courses
var fetchAllCourses = async (req, res) => {
    try {
        const courses = await model.Course.findAll({
            where: { isDeleted: false },
            attributes: { exclude: ["createdAt", "updatedAt"] },
            include: [
                { model: model.Domain, attributes: ["name"] },
                {
                    model: model.CoursePreview,
                    attributes: [["id", "coursePreviewId"], "dayCount"],
                    where: { isDeleted: false },
                    required: false // in case a course has no preview
                }
            ]
        });

        return ReS(res, { success: true, data: courses }, 200);
    } catch (error) {
        console.error("Fetch All Courses Error:", error);
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAllCourses = fetchAllCourses;
// ✅ Fetch single Course by ID
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

// ✅ Soft delete Course
var deleteCourse = async (req, res) => {
    try {
        const course = await model.Course.findByPk(req.params.id);
        if (!course) return ReE(res, "Course not found", 404);

        await course.update({ isDeleted: true });
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

