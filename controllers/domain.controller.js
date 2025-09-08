"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { uploadGeneralFile } = require("../middleware/s3.middleware.js"); // adjust path if needed

// ✅ Add a new Domain with image upload
var addDomain = async (req, res) => {
    uploadGeneralFile.single("image")(req, res, async function (err) {
        if (err) return ReE(res, err.message, 422);

        const { name, description } = req.body;
        if (!name) return ReE(res, "Domain name is required", 400);

        try {
            const domain = await model.Domain.create({
                name,
                description: description || null,
                image: req.file ? req.file.location : null, // S3 URL
            });
            return ReS(res, domain, 201);
        } catch (error) {
            return ReE(res, error.message, 422);
        }
    });
};
module.exports.addDomain = addDomain;

// ✅ Update Domain with optional image upload
var updateDomain = async (req, res) => {
    uploadGeneralFile.single("image")(req, res, async function (err) {
        if (err) return ReE(res, err.message, 422);

        try {
            const domain = await model.Domain.findByPk(req.params.id);
            if (!domain) return ReE(res, "Domain not found", 404);

            await domain.update({
                name: req.body.name || domain.name,
                description: req.body.description !== undefined ? req.body.description : domain.description,
                image: req.file ? req.file.location : domain.image, // update image if uploaded
            });

            return ReS(res, domain, 200);
        } catch (error) {
            return ReE(res, error.message, 500);
        }
    });
};
module.exports.updateDomain = updateDomain;

// ✅ Fetch all Domains
var fetchAllDomains = async (req, res) => {
    try {
        const domains = await model.Domain.findAll({
            where: { isDeleted: false }
        });
        return ReS(res, { success: true, data: domains }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAllDomains = fetchAllDomains;

// ✅ Fetch single Domain by ID
var fetchSingleDomain = async (req, res) => {
    const { id } = req.params;
    if (!id) return ReE(res, "Domain ID is required", 400);

    try {
        const domain = await model.Domain.findByPk(id);
        if (!domain) return ReE(res, "Domain not found", 404);
        return ReS(res, domain, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchSingleDomain = fetchSingleDomain;

// ✅ Soft delete Domain
var deleteDomain = async (req, res) => {
    try {
        const domain = await model.Domain.findByPk(req.params.id);
        if (!domain) return ReE(res, "Domain not found", 404);

        await domain.update({ isDeleted: true });
        return ReS(res, { message: "Domain deleted successfully" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.deleteDomain = deleteDomain;

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
            include: [{ model: model.Domain, attributes: ["name"] }]
        });

        return ReS(res, { success: true, data: courses }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchCoursesByDomain = fetchCoursesByDomain;
