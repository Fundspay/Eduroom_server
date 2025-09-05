"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// ✅ Add DomainType (domainId required)
var addDomainType = async (req, res) => {
    const { name, domainId } = req.body;
    if (!name) return ReE(res, "DomainType name is required", 400);
    if (!domainId) return ReE(res, "domainId is required", 400);

    try {
        // Ensure the domain exists
        const domain = await model.Domain.findByPk(domainId);
        if (!domain || domain.isDeleted) return ReE(res, "Domain not found", 404);

        const domainType = await model.DomainType.create({ name, domainId });
        return ReS(res, domainType, 201);
    } catch (error) {
        return ReE(res, error.message, 422);
    }
};
module.exports.addDomainType = addDomainType;

// ✅ Fetch all DomainTypes
var fetchAllDomainTypes = async (req, res) => {
    try {
        const domainTypes = await model.DomainType.findAll({
            where: { isDeleted: false },
            include: [{ model: model.Domain, as: "Domain" }]
        });
        return ReS(res, { success: true, data: domainTypes }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAllDomainTypes = fetchAllDomainTypes;

// ✅ Fetch single DomainType
var fetchSingleDomainType = async (req, res) => {
    const { id } = req.params;
    if (!id) return ReE(res, "DomainType ID is required", 400);

    try {
        const domainType = await model.DomainType.findByPk(id, {
            include: [{ model: model.Domain, as: "Domain" }]
        });
        if (!domainType) return ReE(res, "DomainType not found", 404);
        return ReS(res, domainType, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchSingleDomainType = fetchSingleDomainType;

// ✅ Update DomainType
var updateDomainType = async (req, res) => {
    try {
        const domainType = await model.DomainType.findByPk(req.params.id);
        if (!domainType) return ReE(res, "DomainType not found", 404);

        await domainType.update({
            name: req.body.name || domainType.name,
            domainId: req.body.domainId || domainType.domainId
        });
        return ReS(res, domainType, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updateDomainType = updateDomainType;

// ✅ Soft delete DomainType
var deleteDomainType = async (req, res) => {
    try {
        const domainType = await model.DomainType.findByPk(req.params.id);
        if (!domainType) return ReE(res, "DomainType not found", 404);

        await domainType.update({ isDeleted: true });
        return ReS(res, { message: "DomainType deleted successfully" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.deleteDomainType = deleteDomainType;
