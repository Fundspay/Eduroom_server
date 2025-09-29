"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { FundsAudit, User, Status } = require("../models");

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
    // Pagination params
    const limit = parseInt(req.query.limit) || 100;   // records per page
    const page = parseInt(req.query.page) || 1;       // current page
    const offset = (page - 1) * limit;

    // Fetch FundsAudit with related User and Status in one query
    const { count, rows } = await FundsAudit.findAndCountAll({
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
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
        },
        {
          model: Status,
          attributes: ["teamManager"]
        }
      ]
    });

    // Transform rows to desired format
    const data = rows.map(audit => ({
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

      userInfo: audit.User
        ? {
            name: `${audit.User.firstName} ${audit.User.lastName}`,
            phoneNumber: audit.User.phoneNumber,
            email: audit.User.email,
            collegeName: audit.User.collegeName,
            businessTargets: audit.User.businessTargets,
            subscriptionWallet: audit.User.subscriptionWallet,
            registeredAt: audit.User.createdAt
          }
        : null,
      teamManager: audit.Status ? audit.Status.teamManager : null
    }));

    // Response with pagination info
    res.json({
      success: true,
      totalRecords: count,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      limit,
      data
    });
  } catch (err) {
    console.error("Error in listAllFundsAudit:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.listAllFundsAudit = listAllFundsAudit;