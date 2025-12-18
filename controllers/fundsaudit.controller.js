"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { FundsAudit, User, Status,Sequelize, TeamManager } = require("../models");
const { Op } = Sequelize;

// ✅ Add a new FundsAudit record
var addFundsAudit = async function (req, res) {
    const {
        userId,
        registeredUserId,
        firstName,
        lastName,
        phoneNumber,
        email,
        dateOfPayment,
        dateOfDownload,
        hasPaid,
        isDownloaded,
        queryStatus,
        isQueryRaised
    } = req.body;

    if (!userId || !registeredUserId) return ReE(res, "userId and registeredUserId are required", 400);

    try {
        const record = await model.FundsAudit.create({
            userId,
            registeredUserId,
            firstName,
            lastName,
            phoneNumber,
            email,
            dateOfPayment,
            dateOfDownload,
            hasPaid,
            isDownloaded,
            queryStatus,
            isQueryRaised
        });
        return ReS(res, record, 201);
    } catch (error) {
        return ReE(res, error.message, 422);
    }
};
module.exports.addFundsAudit = addFundsAudit;

// ✅ Fetch all FundsAudit records
var fetchAllFundsAudit = async function (req, res) {
    try {
        const records = await model.FundsAudit.findAll();
        return ReS(res, { success: true, data: records }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAllFundsAudit = fetchAllFundsAudit;

// ✅ Fetch a single FundsAudit record by ID
var fetchSingleFundsAudit = async function (req, res) {
    try {
        const { id } = req.params;
        if (!id) return ReE(res, "ID is required", 400);

        const record = await model.FundsAudit.findByPk(id);
        if (!record) return ReE(res, "FundsAudit record not found", 404);

        return ReS(res, record, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchSingleFundsAudit = fetchSingleFundsAudit;

// ✅ Update a FundsAudit record
var updateFundsAudit = async function (req, res) {
    try {
        const record = await model.FundsAudit.findByPk(req.params.id);
        if (!record) return ReE(res, "FundsAudit record not found", 404);

        await record.update({
            firstName: req.body.firstName || record.firstName,
            lastName: req.body.lastName || record.lastName,
            phoneNumber: req.body.phoneNumber || record.phoneNumber,
            email: req.body.email || record.email,
            dateOfPayment: req.body.dateOfPayment || record.dateOfPayment,
            dateOfDownload: req.body.dateOfDownload || record.dateOfDownload,
            hasPaid: req.body.hasPaid !== undefined ? req.body.hasPaid : record.hasPaid,
            isDownloaded: req.body.isDownloaded !== undefined ? req.body.isDownloaded : record.isDownloaded,
            queryStatus: req.body.queryStatus || record.queryStatus,
            isQueryRaised: req.body.isQueryRaised !== undefined ? req.body.isQueryRaised : record.isQueryRaised
        });

        return ReS(res, record, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updateFundsAudit = updateFundsAudit;

// ✅ Delete a FundsAudit record (hard delete)
var deleteFundsAudit = async function (req, res) {
    try {
        const record = await model.FundsAudit.findByPk(req.params.id);
        if (!record) return ReE(res, "FundsAudit record not found", 404);

        await record.destroy();
        return ReS(res, { message: "FundsAudit record deleted successfully" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.deleteFundsAudit = deleteFundsAudit;

const listAllFundsAudit = async (req, res) => {
  try {
    // ✅ Pagination params
    const limit = parseInt(req.query.limit) || 100;  // records per page
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    // Fetch FundsAudit with limit & offset
    const { count: totalRecords, rows: fundsAudits } = await FundsAudit.findAndCountAll({
      limit,
      offset,
      order: [["createdAt", "DESC"]]
    });

    const response = [];

    for (const audit of fundsAudits) {
      // Get user info
      const user = await User.findOne({
        where: { id: audit.userId },
        attributes: [
          "id",
          "firstName",
          "lastName",
          "phoneNumber",
          "email",
          "collegeName",
          "businessTargets",
          "subscriptionWallet",
          "createdAt",
        ],
      });

      // Get team manager info from Status
      const status = await Status.findOne({
        where: { userId: audit.userId },
        attributes: ["teamManager"],
      });

      response.push({
        id: audit.id,
        userId: audit.userId,
        registeredUserId: audit.registeredUserId,
        dateOfPayment: audit.dateOfPayment,
        dateOfDownload: audit.dateOfDownload,
        hasPaid: audit.hasPaid,
        isDownloaded: audit.isDownloaded,
        queryStatus: audit.queryStatus,
        isQueryRaised: audit.isQueryRaised,
        createdAt: audit.createdAt,

        // 🔹 Extra joined info
        userInfo: user
          ? {
              name: `${user.firstName} ${user.lastName}`,
              phoneNumber: user.phoneNumber,
              email: user.email,
              collegeName: user.collegeName,
              businessTargets: user.businessTargets,
              subscriptionWallet: user.subscriptionWallet,
              registeredAt: user.createdAt,
            }
          : null,
        teamManager: status ? status.teamManager : null,
      });
    }

    // ✅ Send paginated response
    return res.status(200).json({
      success: true,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: page,
      limit,
      data: response
    });
  } catch (err) {
    console.error("Error in listAllFundsAudit:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports.listAllFundsAudit = listAllFundsAudit;


const listAllFundsAuditByUser = async (req, res) => {
  try {
    const { teamManagerName } = req.query;
    let userIds = null;

    // ✅ If a team manager name is given, find all users under them
    if (teamManagerName) {
      const statuses = await Status.findAll({
        where: {
          teamManager: { [Op.iLike]: `%${teamManagerName}%` } // partial match
        },
        attributes: ["userId"]
      });

      userIds = statuses.map(s => s.userId);

      // ✅ If no users found under that manager, return empty response
      if (!userIds.length) {
        return res.status(200).json({
          success: true,
          totalRecords: 0,
          data: []
        });
      }
    }

    // ✅ Fetch all FundsAudit records (filtered if userIds exist)
    const fundsAudits = await FundsAudit.findAll({
      where: userIds ? { userId: { [Op.in]: userIds } } : {},
      order: [["createdAt", "DESC"]]
    });

    const response = [];

    // ✅ Build final response with user and manager details
    for (const audit of fundsAudits) {
      const user = await User.findOne({
        where: { id: audit.userId },
        attributes: [
          "id",
          "firstName",
          "lastName",
          "phoneNumber",
          "email",
          "collegeName",
          "businessTargets",
          "subscriptionWallet",
          "createdAt"
        ]
      });

      const status = await Status.findOne({
        where: { userId: audit.userId },
        attributes: ["teamManager"]
      });

      response.push({
        id: audit.id,
        userId: audit.userId,
        registeredUserId: audit.registeredUserId,
        dateOfPayment: audit.dateOfPayment,
        dateOfDownload: audit.dateOfDownload,
        hasPaid: audit.hasPaid,
        isDownloaded: audit.isDownloaded,
        queryStatus: audit.queryStatus,
        isQueryRaised: audit.isQueryRaised,
        createdAt: audit.createdAt,

        userInfo: user
          ? {
              name: `${user.firstName} ${user.lastName}`,
              phoneNumber: user.phoneNumber,
              email: user.email,
              collegeName: user.collegeName,
              businessTargets: user.businessTargets,
              subscriptionWallet: user.subscriptionWallet,
              registeredAt: user.createdAt
            }
          : null,

        teamManager: status ? status.teamManager : null
      });
    }

    // ✅ Final response
    return res.status(200).json({
      success: true,
      totalRecords: response.length,
      data: response
    });
  } catch (err) {
    console.error("Error in listAllFundsAuditByUser:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

module.exports.listAllFundsAuditByUser = listAllFundsAuditByUser;

const listAllFundsAuditByCollege = async (req, res) => {
  try {
    const { teamManagerName } = req.query;

    // ✅ Pagination params
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    let userIds = null;
    let extraInfo = {};

    if (teamManagerName) {
      // Partial, case-insensitive match
      const statuses = await Status.findAll({
        where: {
          teamManager: { [Op.iLike]: `%${teamManagerName}%` }
        },
        attributes: ["userId"],
      });

      userIds = statuses.map(s => s.userId);

      if (!userIds.length) {
        return res.status(200).json({
          success: true,
          totalRecords: 0,
          totalPages: 0,
          currentPage: page,
          limit,
          data: [],
          colleges: { total: 0, details: [] },
          interns: { total: 0, details: [] }
        });
      }

      // ✅ Get interns (users under this manager)
      const interns = await User.findAll({
        where: { id: userIds },
        attributes: [
          "id",
          "firstName",
          "lastName",
          "email",
          "phoneNumber",
          "collegeName",
          "createdAt"
        ],
      });

      // ✅ Group colleges (unique by name)
      const collegeMap = new Map();
      interns.forEach(u => {
        if (u.collegeName) {
          collegeMap.set(u.collegeName, {
            collegeName: u.collegeName,
            students: (collegeMap.get(u.collegeName)?.students || 0) + 1
          });
        }
      });

      extraInfo = {
        colleges: {
          total: collegeMap.size,
          details: Array.from(collegeMap.values())
        },
        interns: {
          total: interns.length,
          details: interns.map(u => ({
            id: u.id,
            name: `${u.firstName} ${u.lastName}`,
            email: u.email,
            phoneNumber: u.phoneNumber,
            collegeName: u.collegeName,
            registeredAt: u.createdAt,
          }))
        }
      };
    }

    // Fetch FundsAudit with optional filter
    const { count: totalRecords, rows: fundsAudits } = await FundsAudit.findAndCountAll({
      where: userIds ? { userId: userIds } : {},
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    const response = [];

    for (const audit of fundsAudits) {
      const user = await User.findOne({
        where: { id: audit.userId },
        attributes: [
          "id",
          "firstName",
          "lastName",
          "phoneNumber",
          "email",
          "collegeName",
          "businessTargets",
          "subscriptionWallet",
          "createdAt",
        ],
      });

      const status = await Status.findOne({
        where: { userId: audit.userId },
        attributes: ["teamManager"],
      });

      response.push({
        id: audit.id,
        userId: audit.userId,
        registeredUserId: audit.registeredUserId,
        dateOfPayment: audit.dateOfPayment,
        dateOfDownload: audit.dateOfDownload,
        hasPaid: audit.hasPaid,
        isDownloaded: audit.isDownloaded,
        queryStatus: audit.queryStatus,
        isQueryRaised: audit.isQueryRaised,
        createdAt: audit.createdAt,

        userInfo: user
          ? {
              name: `${user.firstName} ${user.lastName}`,
              phoneNumber: user.phoneNumber,
              email: user.email,
              collegeName: user.collegeName,
              businessTargets: user.businessTargets,
              subscriptionWallet: user.subscriptionWallet,
              registeredAt: user.createdAt,
            }
          : null,
        teamManager: status ? status.teamManager : null,
      });
    }

    return res.status(200).json({
      success: true,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: page,
      limit,
      data: response,
      ...extraInfo, // ✅ add colleges + interns info if managerName is given
    });
  } catch (err) {
    console.error("Error in listAllFundsAudit:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports.listAllFundsAuditByCollege = listAllFundsAuditByCollege;


const { Op } = require("sequelize");
const { TeamManager, Status, FundsAudit } = require("../models"); // Adjust path as needed
const { ReS, ReE } = require("../utils/response"); // Your response helpers

const getPaidAccountsDayWise = async (req, res) => {
  try {
    let { teamManagerId, from, to } = req.query;

    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);
    if (!from || !to) return ReE(res, "from and to dates are required", 400);

    // Convert numeric string to number if possible
    const numericId = Number(teamManagerId);
    const isNumeric = !isNaN(numericId);

    // Find manager by managerId (string) OR id (number)
    const managerRecord = await TeamManager.findOne({
      where: {
        [Op.and]: [{ isDeleted: false, isActive: true }],
        [Op.or]: isNumeric
          ? [{ managerId: teamManagerId }, { id: numericId }]
          : [{ managerId: teamManagerId }],
      },
      attributes: ["id", "managerId", "name", "createdAt"],
    });

    if (!managerRecord) {
      return ReS(
        res,
        {
          success: true,
          data: {},
          message: "Team Manager not found",
        },
        200
      );
    }

    const teamManagerName = managerRecord.name;

    // Find all users under this manager (using Status table)
    const statuses = await Status.findAll({
      where: { teamManager: teamManagerName },
      attributes: ["userId"],
    });

    const userIds = statuses.map((s) => s.userId);
    if (!userIds.length)
      return ReS(res, {
        success: true,
        data: {},
        message: "No users under this manager",
      }, 200);

    // Fetch FundsAudit records where hasPaid = true, filter by dateOfPayment
    const results = await FundsAudit.sequelize.query(
      `
      SELECT DATE("dateOfPayment") AS paid_date,
             COUNT(DISTINCT "userId") AS unique_paid_users
      FROM "FundsAudits"
      WHERE "userId" IN (:userIds)
        AND "hasPaid" = true
        AND "dateOfPayment" BETWEEN :from AND :to
      GROUP BY DATE("dateOfPayment")
      ORDER BY DATE("dateOfPayment");
      `,
      { replacements: { userIds, from, to }, type: FundsAudit.sequelize.QueryTypes.SELECT }
    );

    // Build day-wise object
    const dayWiseCounts = {};
    results.forEach((row) => {
      dayWiseCounts[row.paid_date] = parseInt(row.unique_paid_users);
    });

    return ReS(
      res,
      {
        success: true,
        teamManager: teamManagerName,
        managerId: managerRecord.managerId,
        data: dayWiseCounts,
      },
      200
    );

  } catch (err) {
    console.error("Error in getPaidAccountsDayWise:", err);
    return ReE(res, err.message, 500);
  }
};

module.exports.getPaidAccountsDayWise = getPaidAccountsDayWise;
