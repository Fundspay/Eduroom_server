"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// ✅ Add a new CoursePreview
const addCoursePreview = async (req, res) => {
    const {
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
    if (!domainId) return ReE(res, "domainId is required", 400);
    if (!title) return ReE(res, "title is required", 400);
    if (!heading) return ReE(res, "heading is required", 400);

    try {
        // Ensure course and domain exist
        const course = await model.Course.findByPk(courseId);
        if (!course || course.isDeleted) return ReE(res, "Course not found", 404);

        const domain = await model.Domain.findByPk(domainId);
        if (!domain || domain.isDeleted) return ReE(res, "Domain not found", 404);

        // Ensure whatYouWillLearn is proper JSON with paragraph + bullets
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

        const preview = await model.CoursePreview.create({
            courseId,
            domainId,
            title,
            heading,
            youtubeLink: youtubeLink || null,
            description: description || null,
            dayCount: dayCount || null,
            language: language || null,
            level: level || null,
            whatYouWillLearn: whatYouWillLearnJson,
            duration: duration || null
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
module.exports.fetchAllCoursePreviews = fetchAllCoursePreviews;

// ✅ Fetch single CoursePreview by ID
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
        return ReS(res, preview, 200);
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

        await preview.update({
            courseId: req.body.courseId || preview.courseId,
            domainId: req.body.domainId || preview.domainId,
            title: req.body.title || preview.title,
            heading: req.body.heading || preview.heading,
            youtubeLink: req.body.youtubeLink !== undefined ? req.body.youtubeLink : preview.youtubeLink,
            description: req.body.description !== undefined ? req.body.description : preview.description,
            totalLectures: req.body.totalLectures !== undefined ? req.body.totalLectures : preview.totalLectures,
            language: req.body.language !== undefined ? req.body.language : preview.language,
            whatYouWillLearn: req.body.whatYouWillLearn !== undefined ? req.body.whatYouWillLearn : preview.whatYouWillLearn,
            durationPerDay: req.body.durationPerDay !== undefined ? req.body.durationPerDay : preview.durationPerDay
        });

        return ReS(res, preview, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updateCoursePreview = updateCoursePreview;

// ✅ Soft delete CoursePreview
var deleteCoursePreview = async (req, res) => {
    try {
        const preview = await model.CoursePreview.findByPk(req.params.id);
        if (!preview) return ReE(res, "CoursePreview not found", 404);

        await preview.update({ isDeleted: true });
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
