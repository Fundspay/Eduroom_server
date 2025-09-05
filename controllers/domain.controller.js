"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// ✅ Add a new Domain
var addDomain = async (req, res) => {
    const { name } = req.body;
    if (!name) return ReE(res, "Domain name is required", 400);

    try {
        const domain = await model.Domain.create({ name });
        return ReS(res, domain, 201);
    } catch (error) {
        return ReE(res, error.message, 422);
    }
};
module.exports.addDomain = addDomain;

// ✅ Fetch all Domains
var fetchAllDomains = async (req, res) => {
    try {
        const domains = await model.Domain.findAll({
            where: { isDeleted: false },
            include: [{ model: model.DomainType, as: "DomainTypes", where: { isDeleted: false }, required: false }]
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
        const domain = await model.Domain.findByPk(id, {
            include: [{ model: model.DomainType, as: "DomainTypes", where: { isDeleted: false }, required: false }]
        });
        if (!domain) return ReE(res, "Domain not found", 404);
        return ReS(res, domain, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchSingleDomain = fetchSingleDomain;

// ✅ Update Domain
var updateDomain = async (req, res) => {
    try {
        const domain = await model.Domain.findByPk(req.params.id);
        if (!domain) return ReE(res, "Domain not found", 404);

        await domain.update({ name: req.body.name || domain.name });
        return ReS(res, domain, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updateDomain = updateDomain;

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
