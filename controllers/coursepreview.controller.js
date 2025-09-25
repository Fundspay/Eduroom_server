"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// ✅ Add a new CoursePreview
const addCoursePreview = async (req, res) => {
    try {
        let {
            courseId,
            domainId,
            title,
            heading,
            youtubeLink,
            description,
            dayCount,
            language,
            level,
            whatYouWillLearn,
            duration
        } = req.body;

        if (!courseId) return ReE(res, "courseId is required", 400);
        if (!domainId) return ReE(res, "Valid domainId is required", 400);
        if (!title || !title.trim()) return ReE(res, "title is required", 400);
        if (!heading || !heading.trim()) return ReE(res, "heading is required", 400);

        // 🔹 Ensure course and domain exist
        const course = await model.Course.findByPk(courseId);
        if (!course || course.isDeleted) return ReE(res, "Course not found", 404);

        const domain = await model.Domain.findByPk(domainId);
        if (!domain || domain.isDeleted) return ReE(res, "Domain not found", 404);

        // 🔹 Check if a CoursePreview already exists for this course
        const existingPreview = await model.CoursePreview.findOne({
            where: { courseId, isDeleted: false },
        });
        if (existingPreview) {
            return ReE(res, "This course already has a CoursePreview. Only one is allowed.", 400);
        }

        // 🔹 Parse whatYouWillLearn safely
        let whatYouWillLearnJson = { paragraph: "", bullets: [] };
        if (whatYouWillLearn) {
            if (typeof whatYouWillLearn === "string") {
                try {
                    whatYouWillLearnJson = JSON.parse(whatYouWillLearn);
                } catch (err) {
                    return ReE(res, "Invalid JSON for whatYouWillLearn", 400);
                }
            } else if (typeof whatYouWillLearn === "object") {
                whatYouWillLearnJson = whatYouWillLearn;
            }
        }

        // 🔹 Create the CoursePreview
        const preview = await model.CoursePreview.create({
            courseId,
            domainId,
            title: title.trim(),
            heading: heading.trim(),
            youtubeLink: youtubeLink?.trim() || null,
            description: description?.trim() || null,
            dayCount,
            language: language?.trim() || null,
            level: level?.trim() || null,
            whatYouWillLearn: whatYouWillLearnJson,
            duration: duration?.trim() || null
        });

        return ReS(res, { success: true, data: preview }, 201);

    } catch (error) {
        console.error("Add CoursePreview Error:", error);
        return ReE(res, error.message, 422);
    }
};

module.exports.addCoursePreview = addCoursePreview;

// ✅ Fetch all CoursePreviews
var fetchAllCoursePreviews = async (req, res) => {
    try {
        const previews = await model.CoursePreview.findAll({
            where: { isDeleted: false },
            attributes: [
                ["id", "coursePreviewId"], // 👈 rename id -> coursePreviewId
                "courseId",
                "domainId",
                "title",
                "heading",
                "youtubeLink",
                "description",
                "dayCount",
                "language",
                "level",
                "whatYouWillLearn",
                "duration",
                "createdAt",
                "updatedAt"
            ],
            include: [
                { model: model.Course, attributes: ["name"] },
                { model: model.Domain, attributes: ["name"] }
            ]
        });

        return ReS(res, { success: true, data: previews }, 200);
    } catch (error) {
        console.error("Fetch All CoursePreviews Error:", error);
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAllCoursePreviews = fetchAllCoursePreviews;

// ✅ Get CoursePreviewId by domainId + courseId
const getCoursePreviewId = async (req, res) => {
    try {
        const { domainId, courseId } = req.query;

        if (!domainId || !courseId) {
            return ReE(res, "domainId and courseId are required", 400);
        }

        const preview = await model.CoursePreview.findOne({
            where: {
                domainId: parseInt(domainId, 10),
                courseId: parseInt(courseId, 10),
                isDeleted: false
            },
            attributes: [["id", "coursePreviewId"]] // alias id
        });

        if (!preview) return ReE(res, "CoursePreview not found", 404);

        return ReS(res, { success: true, data: preview }, 200);
    } catch (error) {
        console.error("Get CoursePreviewId Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.getCoursePreviewId = getCoursePreviewId;


var fetchSingleCoursePreview = async (req, res) => {
    const { id } = req.params;
    if (!id) return ReE(res, "CoursePreview ID is required", 400);

    try {
        const preview = await model.CoursePreview.findByPk(id, {
            include: [
                { model: model.Course, attributes: ["name"] },
                { model: model.Domain, attributes: ["name"] }
            ]
        });
        if (!preview) return ReE(res, "CoursePreview not found", 404);

        // Convert to plain object
        const plainPreview = preview.toJSON();

        return ReS(res, plainPreview, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchSingleCoursePreview = fetchSingleCoursePreview;
// ✅ Update CoursePreview
var updateCoursePreview = async (req, res) => {
    try {
        const preview = await model.CoursePreview.findByPk(req.params.id);
        if (!preview) return ReE(res, "CoursePreview not found", 404);

        // Parse whatYouWillLearn safely 
        let whatYouWillLearnJson = preview.whatYouWillLearn;
        if (req.body.whatYouWillLearn) {
            if (typeof req.body.whatYouWillLearn === "string") {
                try {
                    whatYouWillLearnJson = JSON.parse(req.body.whatYouWillLearn);
                } catch (err) {
                    return ReE(res, "Invalid JSON for whatYouWillLearn", 400);
                }
            } else if (typeof req.body.whatYouWillLearn === "object") {
                whatYouWillLearnJson = req.body.whatYouWillLearn;
            }
        }

        await preview.update({
            courseId: req.body.courseId !== undefined ? req.body.courseId : preview.courseId,
            domainId: req.body.domainId !== undefined ? req.body.domainId : preview.domainId,
            title: req.body.title !== undefined ? req.body.title.trim() : preview.title,
            heading: req.body.heading !== undefined ? req.body.heading.trim() : preview.heading,
            youtubeLink: req.body.youtubeLink !== undefined ? req.body.youtubeLink.trim() : preview.youtubeLink,
            description: req.body.description !== undefined ? req.body.description.trim() : preview.description,
            dayCount: req.body.dayCount !== undefined ? req.body.dayCount : preview.dayCount,
            language: req.body.language !== undefined ? req.body.language.trim() : preview.language,
            level: req.body.level !== undefined ? req.body.level.trim() : preview.level,
            whatYouWillLearn: whatYouWillLearnJson,
            duration: req.body.duration !== undefined ? req.body.duration.trim() : preview.duration
        });

        return ReS(res, { success: true, data: preview }, 200);
    } catch (error) {
        console.error("Update CoursePreview Error:", error);
        return ReE(res, error.message, 500);
    }
};
module.exports.updateCoursePreview = updateCoursePreview;


// ✅ Hard delete CoursePreview
var deleteCoursePreview = async (req, res) => {
    try {
        const preview = await model.CoursePreview.findByPk(req.params.id);
        if (!preview) return ReE(res, "CoursePreview not found", 404);

        await preview.destroy(); // <-- hard delete
        return ReS(res, { message: "CoursePreview deleted successfully" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};

module.exports.deleteCoursePreview = deleteCoursePreview;


// ✅ Fetch all CoursePreviews by Course ID
var fetchPreviewsByCourse = async (req, res) => {
    const { courseId } = req.params;
    if (!courseId) return ReE(res, "Course ID is required", 400);

    try {
        const previews = await model.CoursePreview.findAll({
            where: { courseId, isDeleted: false },
            include: [
                { model: model.Course, attributes: ["name"] },
                { model: model.Domain, attributes: ["name"] }
            ]
        });
        return ReS(res, { success: true, data: previews }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchPreviewsByCourse = fetchPreviewsByCourse;
