"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { uploadGeneralFile2 } = require("../middleware/s3.middleware.js"); // adjust path if needed

// ✅ Add a new Course with optional image upload
var addCourse = async (req, res) => {
    uploadGeneralFile2.single("img")(req, res, async function (err) {
        if (err) return ReE(res, err.message, 422);

        const { name, domainId, description, businessTarget, totalDays, duration } = req.body;
        if (!name) return ReE(res, "Course name is required", 400);
        if (!domainId) return ReE(res, "Domain ID is required", 400);

        try {
            const domain = await model.Domain.findByPk(domainId);
            if (!domain || domain.isDeleted) return ReE(res, "Domain not found", 404);

            const course = await model.Course.create({
                name,
                domainId,
                img: req.file ? req.file.location : null,
                description: description || null,
                businessTarget: businessTarget || null,
                totalDays: totalDays || null,
                duration: duration || null
            });

            // Fetch course with nested domain without circular references
            const response = await model.Course.findOne({
                where: { id: course.id },
                attributes: ["id", "name", "img", "description", "businessTarget", "totalDays", "duration", "domainId"],
                include: [
                    { model: model.Domain, attributes: ["id", "name"] }
                ],
                raw: true,
                nest: true
            });

            return ReS(res, response, 201);

        } catch (error) {
            return ReE(res, error.message, 422);
        }
    });
};
module.exports.addCourse = addCourse;

// ✅ Fetch all Courses
var fetchAllCourses = async (req, res) => {
    try {
        const courses = await model.Course.findAll({
            where: { isDeleted: false },
            attributes: ["id", "name", "img", "description", "businessTarget", "totalDays", "duration", "domainId"],
            include: [{ model: model.Domain, attributes: ["id", "name"] }],
            raw: true,
            nest: true
        });

        return ReS(res, { success: true, data: courses }, 200);

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAllCourses = fetchAllCourses;

// ✅ Fetch single Course
var fetchSingleCourse = async (req, res) => {
    const { id } = req.params;
    if (!id) return ReE(res, "Course ID is required", 400);

    try {
        const course = await model.Course.findOne({
            where: { id, isDeleted: false },
            attributes: ["id", "name", "img", "description", "businessTarget", "totalDays", "duration", "domainId"],
            include: [{ model: model.Domain, attributes: ["id", "name"] }],
            raw: true,
            nest: true
        });

        if (!course) return ReE(res, "Course not found", 404);

        return ReS(res, course, 200);

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchSingleCourse = fetchSingleCourse;

// ✅ Update Course with optional image upload
var updateCourse = async (req, res) => {
    uploadGeneralFile2.single("img")(req, res, async function (err) {
        if (err) return ReE(res, err.message, 422);

        try {
            const course = await model.Course.findByPk(req.params.id);
            if (!course) return ReE(res, "Course not found", 404);

            await course.update({
                name: req.body.name || course.name,
                domainId: req.body.domainId || course.domainId,
                img: req.file ? req.file.location : course.img,
                description: req.body.description !== undefined ? req.body.description : course.description,
                businessTarget: req.body.businessTarget !== undefined ? req.body.businessTarget : course.businessTarget,
                totalDays: req.body.totalDays !== undefined ? req.body.totalDays : course.totalDays,
                duration: req.body.duration !== undefined ? req.body.duration : course.duration,
            });

            // Fetch updated course without circular references
            const updatedCourse = await model.Course.findOne({
                where: { id: course.id },
                attributes: ["id", "name", "img", "description", "businessTarget", "totalDays", "duration", "domainId"],
                include: [{ model: model.Domain, attributes: ["id", "name"] }],
                raw: true,
                nest: true
            });

            return ReS(res, updatedCourse, 200);

        } catch (error) {
            return ReE(res, error.message, 500);
        }
    });
};
module.exports.updateCourse = updateCourse;

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
            attributes: ["id", "name", "img", "description", "businessTarget", "totalDays", "duration", "domainId"],
            include: [{ model: model.Domain, attributes: ["id", "name"] }],
            raw: true,
            nest: true
        });

        return ReS(res, { success: true, data: courses }, 200);

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchCoursesByDomain = fetchCoursesByDomain;
