"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// ✅ Add a new Raise Query
var addRaiseQuery = async (req, res) => {
    const { userId, fundsAuditUserId, description, internshipStatus } = req.body;

    if (!userId || !fundsAuditUserId) return ReE(res, "userId and fundsAuditUserId are required", 400);

    try {
        const raiseQuery = await model.RaiseQuery.create({
            userId,
            fundsAuditUserId,
            isQueryRaised: true, // mark as raised
            description: description || null,
            internshipStatus: internshipStatus || null
        });

        return ReS(res, { success: true, query: raiseQuery }, 201);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.addRaiseQuery = addRaiseQuery;

// ✅ Update Raise Query by ID
var updateRaiseQuery = async (req, res) => {
    const { id } = req.params;
    const { fundsAuditUserId, isQueryRaised, description, internshipStatus } = req.body;

    if (!id) return ReE(res, "Query ID is required", 400);

    try {
        const raiseQuery = await model.RaiseQuery.findByPk(id);
        if (!raiseQuery) return ReE(res, "RaiseQuery not found", 404);

        await raiseQuery.update({
            fundsAuditUserId: fundsAuditUserId || raiseQuery.fundsAuditUserId,
            isQueryRaised: isQueryRaised !== undefined ? isQueryRaised : raiseQuery.isQueryRaised,
            description: description || raiseQuery.description,
            internshipStatus: internshipStatus || raiseQuery.internshipStatus
        });

        return ReS(res, { success: true, query: raiseQuery }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updateRaiseQuery = updateRaiseQuery;

// ✅ Fetch all Raise Queries
var fetchAllRaiseQueries = async (req, res) => {
    try {
        const queries = await model.RaiseQuery.findAll({
            where: { isDeleted: false },
            include: [
                { model: model.User, attributes: ["id", "firstName", "lastName", "email"] },
                { model: model.User, as: "auditUser", attributes: ["id", "firstName", "lastName", "email"] }
            ]
        });

        return ReS(res, { success: true, data: queries }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAllRaiseQueries = fetchAllRaiseQueries;

// ✅ Fetch single Raise Query by ID
var fetchSingleRaiseQuery = async (req, res) => {
    const { id } = req.params;
    if (!id) return ReE(res, "Query ID is required", 400);

    try {
        const raiseQuery = await model.RaiseQuery.findByPk(id, {
            include: [
                { model: model.User, attributes: ["id", "firstName", "lastName", "email"] },
                { model: model.User, as: "auditUser", attributes: ["id", "firstName", "lastName", "email"] }
            ]
        });

        if (!raiseQuery) return ReE(res, "RaiseQuery not found", 404);
        return ReS(res, { success: true, query: raiseQuery }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchSingleRaiseQuery = fetchSingleRaiseQuery;
