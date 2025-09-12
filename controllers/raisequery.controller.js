"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

// ✅ Add a new Raise Query
var addRaiseQuery = async (req, res) => {
    const {
        userId,
        fundsAuditUserId,
        queryStatus,
        first_name,
        last_name,
        phone_number
    } = req.body;

    if (!userId || !fundsAuditUserId) 
        return ReE(res, "userId and fundsAuditUserId are required", 400);

    try {
        // Fetch user info for defaults
        const user = await model.User.findByPk(userId, {
            attributes: ["firstName", "lastName", "phoneNumber"]
        });
        if (!user) return ReE(res, "User not found", 404);

        // Default queryStatus to "Pending" if not provided
        const finalQueryStatus = queryStatus || "Pending";

        const raiseQuery = await model.RaiseQuery.create({
            userId,
            fundsAuditUserId,
            first_name: first_name || user.firstName,
            last_name: last_name || user.lastName,
            phone_number: phone_number || user.phoneNumber,
            isQueryRaised: true,         // always true
            queryStatus: finalQueryStatus // default to "Pending"
        });

        return ReS(res, { success: true, query: raiseQuery }, 201);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};

module.exports.addRaiseQuery = addRaiseQuery;

// ✅ Update the latest Raise Query by userId
var updateRaiseQueryByUser = async (req, res) => {
    const { userId } = req.params;
    const { fundsAuditUserId, queryStatus, first_name, last_name, phone_number } = req.body;

    if (!userId) return ReE(res, "userId is required", 400);

    try {
        // Find the latest RaiseQuery for the user
        const raiseQuery = await model.RaiseQuery.findOne({
            where: { userId, isDeleted: false },
            order: [["updatedAt", "DESC"]]
        });

        if (!raiseQuery) return ReE(res, "No RaiseQuery found for this user", 404);

        // Update fields, always mark query as raised
        await raiseQuery.update({
            fundsAuditUserId: fundsAuditUserId || raiseQuery.fundsAuditUserId,
            isQueryRaised: true,                     // always true on update
            queryStatus: queryStatus || "Pending",   // default to "Pending" if not provided
            first_name: first_name || raiseQuery.first_name,
            last_name: last_name || raiseQuery.last_name,
            phone_number: phone_number || raiseQuery.phone_number
        });

        return ReS(res, { success: true, query: raiseQuery }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};

module.exports.updateRaiseQueryByUser = updateRaiseQueryByUser;

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

// ✅ Fetch Raise Queries by userId
// ✅ Fetch Raise Queries by userId with Team Manager info
var fetchRaiseQueriesByUser = async (req, res) => {
    const { userId } = req.params;

    if (!userId) return ReE(res, "userId is required", 400);

    try {
        // Fetch all queries for this user + include linked User info
        const queries = await model.RaiseQuery.findAll({
            where: { userId, isDeleted: false },
            order: [["createdAt", "ASC"]], // or DESC if you want latest first
            include: [
                {
                    model: model.User,
                    attributes: ["id", "firstName", "lastName", "email", "phoneNumber", "teamManagerId"],
                },
            ],
        });

        const queryCount = queries.length;

        // Update queryCount for all queries of this user
        await model.RaiseQuery.update(
            { queryCount },
            { where: { userId, isDeleted: false } }
        );

        // Fetch all team managers for this user's queries
        const teamManagerIds = queries
            .map(q => q.User?.teamManagerId)
            .filter(id => id); // only truthy IDs

        const teamManagers = await model.TeamManager.findAll({
            where: { id: teamManagerIds },
            attributes: ["id", "name"],
            raw: true,
        });

        const managerMap = {};
        teamManagers.forEach(tm => {
            managerMap[tm.id] = tm.name;
        });

        // Format response
        const formattedQueries = queries.map((q) => {
            const plainQ = q.toJSON();
            const userTeamManagerId = plainQ.User?.teamManagerId;
            return {
                ...plainQ,
                queryCount, // ensure latest total count
                queryDate: plainQ.createdAt,
                userDetails: {
                    id: plainQ.User?.id || null,
                    firstName: plainQ.User?.firstName || null,
                    lastName: plainQ.User?.lastName || null,
                    email: plainQ.User?.email || null,
                    phoneNumber: plainQ.User?.phoneNumber || null,
                    teamManagerName: userTeamManagerId ? managerMap[userTeamManagerId] : null
                },
            };
        });

        return ReS(res, { success: true, count: queryCount, queries: formattedQueries }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};

module.exports.fetchRaiseQueriesByUser = fetchRaiseQueriesByUser;
