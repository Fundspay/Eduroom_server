"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { FundsAudit, User, Status,Sequelize, TeamManager } = require("../models");
const { Op } = Sequelize;

// ✅ Add a new FundsAudit record
// ===========================
// Safe FundsAudit Upsert Handler
// ===========================
const addFundsAudit = async function (req, res) {
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
        isQueryRaised,
        occupation
    } = req.body;

    if (!userId || !registeredUserId) {
        return ReE(res, "userId and registeredUserId are required", 400);
    }

    try {
        // --- Upsert the record ---
        const [record, created] = await model.FundsAudit.upsert(
            {
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
                isQueryRaised,
                occupation
            },
            {
                conflictFields: ["userId", "registeredUserId"], // uses unique index
                returning: true,
            }
        );

        // --- Send response ---
        return ReS(res, {
            record,
            created, // true = new record inserted, false = existing record updated
        }, created ? 201 : 200);

    } catch (error) {
        console.error("FundsAudit upsert error:", error);
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

const upsertFundsAuditByRegisteredUser = async (req, res) => {
  try {
    const { registeredUserId } = req.params;
    const { managerReview, userReview } = req.body;

    if (!registeredUserId) return ReE(res, "registeredUserId is required", 400);
    if (managerReview === undefined && userReview === undefined) {
      return ReE(res, "Nothing to update", 400);
    }

    // Find the existing record by registeredUserId
    let record = await model.FundsAudit.findOne({ where: { registeredUserId } });

    const updateFields = {};
    if (managerReview !== undefined) updateFields.managerReview = managerReview;
    if (userReview !== undefined) updateFields.userReview = userReview;

    if (record) {
      // 🔹 Update existing record
      await model.FundsAudit.update(updateFields, { where: { registeredUserId } });
    } else {
      // 🔹 Insert new record with default values if not provided
      record = await model.FundsAudit.create({
        registeredUserId,
        managerReview: managerReview || "not completed",
        userReview: userReview || "not completed",
      });
    }

    // Fetch updated/created record
    const finalRecord = await model.FundsAudit.findOne({
      where: { registeredUserId },
      attributes: ["id", "userId", "registeredUserId", "managerReview", "userReview"],
      raw: true,
    });

    return ReS(res, { success: true, data: finalRecord }, 200);

  } catch (error) {
    console.error("Upsert FundsAudit by RegisteredUserId Error:", error);
    return ReE(res, error.message || "Internal error", 500);
  }
};

module.exports.upsertFundsAuditByRegisteredUser = upsertFundsAuditByRegisteredUser;


const getAllFundsAuditList = async (req, res) => {
  try {
    console.debug("[DEBUG] Fetching all FundsAudit records...");

    // Fetch ALL FundsAudit records (no filters)
    const fundsAuditRecords = await model.FundsAudit.findAll({
      attributes: [
        'id',
        'userId',
        'firstName',
        'lastName',
        'phoneNumber',
        'email',
        'dateOfPayment',
        'dateOfDownload',
        'hasPaid',
        'isDownloaded',
        'createdAt',
        'updatedAt'
      ],
      order: [['createdAt', 'DESC']],
      raw: true
    });

    console.debug("[DEBUG] Total FundsAudit records fetched:", fundsAuditRecords.length);

    if (fundsAuditRecords.length === 0) {
      return ReS(res, {
        success: true,
        data: [],
        count: 0
      });
    }

    // Get all unique userIds from FundsAudit
    const userIds = [...new Set(fundsAuditRecords.map(f => f.userId))];
    console.debug("[DEBUG] Unique user IDs:", userIds.length);

    // Fetch Users to get their phone numbers
    const users = await model.User.findAll({
      where: { id: userIds },
      attributes: ['id', 'phoneNumber'],
      raw: true
    });

    // Create userId -> phoneNumber map
    const userPhoneMap = {};
    users.forEach(u => {
      userPhoneMap[u.id] = u.phoneNumber;
    });

    // Fetch all StudentResumes to get manager allocations
    const allPhoneNumbers = users.map(u => u.phoneNumber).filter(Boolean);
    const studentResumes = await model.StudentResume.findAll({
      where: { mobileNumber: allPhoneNumbers },
      attributes: ['mobileNumber', 'alloted'],
      raw: true
    });

    // Create phoneNumber -> manager map
    const phoneManagerMap = {};
    studentResumes.forEach(s => {
      phoneManagerMap[s.mobileNumber] = s.alloted;
    });

    console.debug("[DEBUG] Phone-Manager mappings:", Object.keys(phoneManagerMap).length);

    // Format the response with manager information
    const formattedRecords = fundsAuditRecords.map(record => {
      const userPhone = userPhoneMap[record.userId];
      const assignedManager = phoneManagerMap[userPhone] || null;

      return {
        id: record.id,
        userId: record.userId,
        name: `${record.firstName || ''} ${record.lastName || ''}`.trim() || null,
        phoneNumber: record.phoneNumber,
        email: record.email,
        dateOfPayment: record.dateOfPayment,
        dateOfDownload: record.dateOfDownload,
        hasPaid: record.hasPaid,
        isDownloaded: record.isDownloaded,
        managerName: assignedManager,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      };
    });

    return ReS(res, {
      success: true,
      data: formattedRecords,
      count: formattedRecords.length
    });

  } catch (error) {
    console.error("[ERROR] Get All Funds Audit List:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getAllFundsAuditList = getAllFundsAuditList;

const getEntriesByDateRange = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString().split('T')[0];
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString().split('T')[0];
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);

    const records = await model.FundsAudit.findAll({
      where: {
        [Op.or]: [
          { dateOfDownload: { [Op.between]: [startDateObj, endDateObj] } },
          { dateOfPayment: { [Op.between]: [startDateObj, endDateObj] } }
        ]
      },
      raw: true
    });

    const formattedRecords = records.map(r => {
      const downloadInRange =
        r.dateOfDownload &&
        new Date(r.dateOfDownload) >= startDateObj &&
        new Date(r.dateOfDownload) <= endDateObj;

      const paymentInRange =
        r.dateOfPayment &&
        new Date(r.dateOfPayment) >= startDateObj &&
        new Date(r.dateOfPayment) <= endDateObj;

      return {
        id: r.id,
        userId: r.userId,
        name: `${r.firstName || ''} ${r.lastName || ''}`.trim() || null,
        phoneNumber: r.phoneNumber,
        email: r.email,
        dateOfDownload: downloadInRange ? r.dateOfDownload : null,
        dateOfPayment: paymentInRange ? r.dateOfPayment : null,
        isDownloaded: downloadInRange ? r.isDownloaded : false,
        hasPaid: paymentInRange ? r.hasPaid : false,
        referrer: r.referrer,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      };
    });

    return ReS(res, {
      success: true,
      data: formattedRecords,
      summary: {
        total: formattedRecords.length,
        downloads: formattedRecords.filter(r => r.isDownloaded).length,
        payments: formattedRecords.filter(r => r.hasPaid).length
      },
      appliedFilters: { startDate, endDate }
    });

  } catch (error) {
    console.error(error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getEntriesByDateRange = getEntriesByDateRange;

const getDownloadsVsPayments = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      const today = new Date().toISOString().split('T')[0];
      startDate = today;
      endDate = today;
    }

    const records = await model.FundsAudit.findAll({
      attributes: [
        'dateOfDownload',
        'dateOfPayment',
        'isDownloaded',
        'hasPaid'
      ],
      raw: true
    });

    let totalDownloads = 0;
    let totalPayments = 0;
    let downloadsNotPaid = 0;

    const dayWiseMap = {};

    records.forEach(r => {

      /* ========= DOWNLOAD ========= */
      if (r.isDownloaded && r.dateOfDownload) {
        const downloadDate = r.dateOfDownload.split('T')[0];

        if (downloadDate >= startDate && downloadDate <= endDate) {
          totalDownloads++;

          dayWiseMap[downloadDate] ??= {
            date: downloadDate,
            downloads: 0,
            payments: 0
          };
          dayWiseMap[downloadDate].downloads++;

          const paymentInRange =
            r.hasPaid &&
            r.dateOfPayment &&
            r.dateOfPayment.split('T')[0] >= startDate &&
            r.dateOfPayment.split('T')[0] <= endDate;

          if (!paymentInRange) {
            downloadsNotPaid++;
          }
        }
      }

      /* ========= PAYMENT ========= */
      if (r.hasPaid && r.dateOfPayment) {
        const paymentDate = r.dateOfPayment.split('T')[0];

        if (paymentDate >= startDate && paymentDate <= endDate) {
          totalPayments++;

          dayWiseMap[paymentDate] ??= {
            date: paymentDate,
            downloads: 0,
            payments: 0
          };
          dayWiseMap[paymentDate].payments++;
        }
      }

    });

    const dayWiseBreakdown = Object.values(dayWiseMap)
      .sort((a, b) => b.date.localeCompare(a.date));

    const conversionRate =
      totalDownloads > 0
        ? ((totalPayments / totalDownloads) * 100).toFixed(1)
        : '0.0';

    return ReS(res, {
      success: true,
      summary: {
        totalDownloads,
        totalPayments,
        downloadsNotPaid,
        conversionRate: parseFloat(conversionRate),
        conversionRateText: `${conversionRate}%`
      },
      dayWiseBreakdown,
      appliedFilters: { startDate, endDate }
    });

  } catch (error) {
    console.error('[ERROR] getDownloadsVsPayments:', error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getDownloadsVsPayments = getDownloadsVsPayments;
