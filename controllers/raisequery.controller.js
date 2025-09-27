"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

// ✅ Add a new Raise Query
const addQuery = async (req, res) => {
  try {
    const { userId, first_name, last_name, email, phone_number } = req.body;

    // Ensure user exists
    const user = await model.User.findByPk(userId);
    if (!user) return ReE(res, "User not found", 404);

    // Increment queryCount if row exists, else create new
    const [raiseQuery, created] = await model.RaiseQuery.findOrCreate({
      where: { userId },
      defaults: {
        first_name,
        last_name,
        email,
        phone_number,
        isQueryRaised: true,
        queryCount: 0, // start from 0, will increment below
        queryStatus: "Active",
      },
    });

    // Increment the count
    await raiseQuery.increment("queryCount");
    await raiseQuery.reload();

    // Ensure isQueryRaised is true
    if (!raiseQuery.isQueryRaised) {
      raiseQuery.isQueryRaised = true;
      await raiseQuery.save();
    }

    return ReS(res, { success: true, raiseQuery }, 200);
  } catch (error) {
    console.error("Add Query Error:", error);
    return ReE(res, error.message || "Internal Server Error", 500);
  }
};
module.exports.addQuery = addQuery;
// ✅ Update the latest Raise Query by userId
var updateRaiseQueryByUser = async (req, res) => {
    const { userId } = req.params;
    const { fundsAuditUserId, queryStatus, first_name, last_name, phone_number,email } = req.body;

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
            email: email || raiseQuery.email,
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
      
            ]
        });

        return ReS(res, { success: true, data: queries }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAllRaiseQueries = fetchAllRaiseQueries;

// ✅ Fetch Raise Queries by userId
const fetchRaiseQueriesByUser = async (req, res) => {
  const { userId } = req.params;

  if (!userId) return ReE(res, "userId is required", 400);

  try {
    // Fetch all queries for the user, including user and team manager info
    const queries = await model.RaiseQuery.findAll({
      where: { userId, isDeleted: false },
      order: [["createdAt", "ASC"]],
      include: [
        {
          model: model.User,
          attributes: ["id", "firstName", "lastName", "email", "phoneNumber"],
          include: [
            {
              model: model.TeamManager,
              as: "teamManager",
              attributes: ["id", "name"] // fetch the team manager name
            }
          ]
        }
      ]
    });

    const queryCount = queries.length;

    // Format the response
    const formattedQueries = queries.map(q => {
      const plainQ = q.toJSON();
      return {
        ...plainQ,
        status: plainQ.status ?? null,   // include query status
        queryCount,                     // total queries for the user
        queryDate: plainQ.createdAt,
        userDetails: {
          id: plainQ.User?.id ?? null,
          firstName: plainQ.User?.firstName ?? null,
          lastName: plainQ.User?.lastName ?? null,
          email: plainQ.User?.email ?? null,
          phoneNumber: plainQ.User?.phoneNumber ?? null,
          teamManagerName: plainQ.User?.teamManager?.name ?? null
        },
      };
    });

    return ReS(res, { success: true, count: queryCount, queries: formattedQueries }, 200);
  } catch (error) {
    console.error("Error fetching raise queries:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchRaiseQueriesByUser = fetchRaiseQueriesByUser;
