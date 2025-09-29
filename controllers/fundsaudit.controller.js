"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { FundsAudit, User, Status,Sequelize } = require("../models");
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

    // ✅ Pagination params
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    let userIds = null;

    if (teamManagerName) {
      // Partial, case-insensitive match
      const statuses = await Status.findAll({
        where: {
          teamManager: { [Op.iLike]: `%${teamManagerName}%` }
        },
        attributes: ["userId"]
      });

      userIds = statuses.map(s => s.userId);

      if (!userIds.length) {
        return res.status(200).json({
          success: true,
          totalRecords: 0,
          totalPages: 0,
          currentPage: page,
          limit,
          data: []
        });
      }
    }

    // Fetch FundsAudit with optional filter
    const { count: totalRecords, rows: fundsAudits } = await FundsAudit.findAndCountAll({
      where: userIds ? { userId: userIds } : {},
      limit,
      offset,
      order: [["createdAt", "DESC"]]
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