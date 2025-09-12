"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");


// ✅ Add a new Raise Query with optional extra fields
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

        const raiseQuery = await model.RaiseQuery.create({
            userId,
            fundsAuditUserId,
            first_name: first_name || user.firstName,
            last_name: last_name || user.lastName,
            phone_number: phone_number || user.phoneNumber,
            isQueryRaised: true, // mark as raised
            queryStatus: queryStatus || null
        });

        return ReS(res, { success: true, query: raiseQuery }, 201);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};

module.exports.addRaiseQuery = addRaiseQuery;

// ✅ Update Raise Query by userId (latest query)
var updateRaiseQueryByUser = async (req, res) => {
    const { userId } = req.params;
    const { fundsAuditUserId, isQueryRaised, queryStatus, first_name, last_name, phone_number } = req.body;

    if (!userId) return ReE(res, "userId is required", 400);

    try {
        // Find the latest RaiseQuery for the user
        const raiseQuery = await model.RaiseQuery.findOne({
            where: { userId, isDeleted: false },
            order: [["updatedAt", "DESC"]]
        });

        if (!raiseQuery) return ReE(res, "No RaiseQuery found for this user", 404);

        // Update fields, fallback to existing values if not provided
        await raiseQuery.update({
            fundsAuditUserId: fundsAuditUserId || raiseQuery.fundsAuditUserId,
            isQueryRaised: isQueryRaised !== undefined ? isQueryRaised : raiseQuery.isQueryRaised,
            queryStatus: queryStatus || raiseQuery.queryStatus,
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

var fetchRaiseQueriesByUser = async (req, res) => {
  const { userId } = req.params;

  if (!userId) return ReE(res, "userId is required", 400);

  try {
    // Fetch all queries for this user + include linked User info
    const queries = await model.RaiseQuery.findAll({
      where: { userId, isDeleted: false },
      order: [["updatedAt", "DESC"]],
      include: [
        {
          model: model.User,
          attributes: ["id", "name", "email", "phone"], // adjust to your User model fields
        },
      ],
    });

    const queryCount = queries.length;

    // ✅ Update queryCount in all RaiseQuery rows for this user
    await model.RaiseQuery.update(
      { queryCount },
      { where: { userId, isDeleted: false } }
    );

    // Format response
    const formattedQueries = queries.map((q) => {
      const plainQ = q.toJSON();

      return {
        ...plainQ, // keep all RaiseQuery fields (id, queryStatus, first_name, last_name, phone_number, etc.)
        queryDate: plainQ.createdAt, // attach human-readable query date
        userDetails: {
          id: plainQ.User?.id || null,
          name: plainQ.User?.name || null,
          email: plainQ.User?.email || null,
          phone: plainQ.User?.phone || null,
        },
      };
    });

    return ReS(res, { success: true, count: queryCount, queries: formattedQueries }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchRaiseQueriesByUser = fetchRaiseQueriesByUser;
