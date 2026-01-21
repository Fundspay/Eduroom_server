"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, Sequelize } = require("sequelize");
const axios = require("axios");
const { TeamManager, BdTarget , Status,FundsAudit,BdSheet } = require("../models");

const upsertBdSheet = async (req, res) => {
  try {
    let { studentResumeId } = req.body;
    if (!studentResumeId) return ReE(res, "studentResumeId is required", 400);

    //  FORCE STRING (critical fix)
    studentResumeId = String(studentResumeId);
    req.body.studentResumeId = studentResumeId;

    // ---- FETCH RESUME ----
    const resume = await model.StudentResume.findOne({
      where: { id: studentResumeId },
    });

    // ONLY registration auto-fill remains
    if (resume) {
      const user = await model.User.findOne({
        where: { phoneNumber: resume.mobileNumber },
      });

      if (user) {
        req.body.registration = user.createdAt ? "completed" : "not completed";
      }
    }

    // ------- UPSERT -------
    let sheet = await model.BdSheet.findOne({
      where: { studentResumeId: String(studentResumeId) },
    });

    if (sheet) {
      const updateFields = { ...req.body };

      // prevent accidental wipes
      Object.keys(updateFields).forEach((key) => {
        if (updateFields[key] === null || updateFields[key] === undefined) {
          delete updateFields[key];
        }
      });

      console.log("FIELDS TO UPDATE:", updateFields);

      // 🔥 MERGE JSON fields instead of replacing
      ["day1", "day2", "day3", "day4", "day5", "day6", "day7"].forEach((dayKey) => {
        if (updateFields[dayKey] && sheet[dayKey]) {
          // Merge existing JSON with new JSON
          updateFields[dayKey] = {
            ...sheet[dayKey],
            ...updateFields[dayKey],
          };
        }
      });

      await sheet.update(updateFields, { fields: Object.keys(updateFields) });

      // return fresh data from DB
      const updatedSheet = await model.BdSheet.findByPk(sheet.id);
      return ReS(res, {
        message: "BdSheet updated successfully",
        data: updatedSheet,
      });
    }

    // CREATE (only when truly missing)
    const newSheet = await model.BdSheet.create(req.body);
    return ReS(res, {
      message: "BdSheet created successfully",
      data: newSheet,
    });
  } catch (error) {
    console.log("BD SHEET UPSERT ERROR:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.upsertBdSheet = upsertBdSheet;


// const getBdSheet = async (req, res) => {
//   try {
//     const { resumeId, managerId } = req.query;

//     let whereCondition = {};

//     if (resumeId) {
//       whereCondition.id = resumeId;
//     }

//     if (managerId) {
//       const manager = await model.TeamManager.findOne({
//         where: { id: managerId },
//         attributes: ["name"],
//       });

//       if (manager && manager.name) {
//         whereCondition.alloted = manager.name;
//       } else {
//         whereCondition.alloted = "__invalid__";
//       }
//     }

//     const data = await model.StudentResume.findAll({
//       where: whereCondition,
//       attributes: [
//         "id",
//         "sr",
//         "studentName",
//         "mobileNumber",
//         "emailId",
//         "domain",
//         "collegeName",
//       ],
//       include: [
//         {
//           model: model.BdSheet,
//           required: false,
//           attributes: {
//             include: [
//               "businessTask",
//               "registration",
//               "activeStatus",
//               "startDate", // FIX (this is why it was missing)
//               "endDate",
//             ],
//           },
//         },
//       ],
//       order: [["id", "DESC"]],
//     });

//     const formattedData = await Promise.all(
//       data.map(async (student) => {
//         const s = student.toJSON();

//         // ALWAYS PICK LATEST BdSheet
//         if (Array.isArray(s.BdSheet)) {
//           s.BdSheet = s.BdSheet.sort((a, b) => b.id - a.id)[0] || null;
//         }

//         // Fetch user for wallet + userId + collegeName
//         if (s.mobileNumber) {
//           const user = await model.User.findOne({
//             where: { phoneNumber: s.mobileNumber },
//             attributes: [
//               "subscriptionWallet",
//               "subscriptiondeductedWallet",
//               "id",
//               "collegeName",
//             ],
//           });

//           if (user) {
//             // ONLY subscriptionWallet is used now
//             const businessTask = parseInt(user.subscriptionWallet || 0, 10);
//             s.businessTask = businessTask;

//             s.userId = user.id;
//             s.collegeName = user.collegeName;

//             if (!businessTask || businessTask === 0) s.category = "not working";
//             else if (businessTask >= 1 && businessTask <= 5)
//               s.category = "Starter";
//             else if (businessTask >= 6 && businessTask <= 10)
//               s.category = "Basic";
//             else if (businessTask >= 11 && businessTask <= 15)
//               s.category = "Bronze";
//             else if (businessTask >= 16 && businessTask <= 20)
//               s.category = "Silver";
//             else if (businessTask >= 21 && businessTask <= 25)
//               s.category = "Gold";
//             else if (businessTask >= 26 && businessTask <= 35)
//               s.category = "Diamond";
//             else if (businessTask >= 36 && businessTask <= 70)
//               s.category = "Platinum";
//           }
//         }

//         if (s.BdSheet && s.BdSheet.registration) {
//           s.registration = s.BdSheet.registration;
//         }

//         if (s.BdSheet) {
//           delete s.BdSheet.registration;
//         }

//         return s;
//       })
//     );

//     const managers = await model.TeamManager.findAll({
//       attributes: ["id", "name", "email"],
//       raw: true,
//     });

//     return ReS(res, {
//       count: formattedData.length,
//       data: formattedData,
//       managers: managers,
//     });
//   } catch (err) {
//     console.log("GET BD SHEET ERROR:", err);
//     return ReE(res, err.message, 500);
//   }
// };

// module.exports.getBdSheet = getBdSheet;


const getBdSheet = async (req, res) => {
  try {
    const { resumeId, managerId } = req.query;

    let whereCondition = {};
    if (resumeId) whereCondition.id = resumeId;

    if (managerId) {
      const manager = await model.TeamManager.findOne({
        where: { id: managerId },
        attributes: ["name"],
      });
      whereCondition.alloted = manager?.name || "__invalid__";
    }

    const data = await model.StudentResume.findAll({
      where: whereCondition,
      attributes: [
        "id",
        "sr",
        "studentName",
        "mobileNumber",
        "emailId",
        "domain",
        "collegeName",
      ],
      include: [
        {
          model: model.BdSheet,
          required: false,
          attributes: ["registration", "activeStatus", "startDate", "endDate"],
        },
      ],
      order: [["id", "DESC"]],
    });

    const formattedData = await Promise.all(
      data.map(async (student) => {
        const s = student.toJSON();

        // Pick latest BdSheet
        if (Array.isArray(s.BdSheet)) {
          s.BdSheet = s.BdSheet.sort((a, b) => b.id - a.id)[0] || null;
        }

        if (s.mobileNumber) {
          const user = await model.User.findOne({
            where: { phoneNumber: s.mobileNumber },
            attributes: ["id", "collegeName"],
          });

          if (user) {
            s.userId = user.id;
            s.collegeName = user.collegeName;

            // ✅ Get all payments with dates
            const payments = await model.FundsAudit.findAll({
              where: { userId: user.id, hasPaid: true },
              attributes: ["dateOfPayment"],
              order: [["dateOfPayment", "ASC"]],
            });

            const totalAccounts = payments.length;
            const dateWiseAccounts = payments.map(p => ({
              date: p.dateOfPayment,
            }));

            s.accountsAchieved = totalAccounts;
            s.businessTask = totalAccounts; // same column, now correct
            s.hasPaid = totalAccounts > 0;
            s.firstPaymentDate = payments[0]?.dateOfPayment || null;
            s.lastPaymentDate = payments[totalAccounts - 1]?.dateOfPayment || null;
            s.category =
              totalAccounts === 0
                ? "not working"
                : totalAccounts <= 5
                ? "Starter"
                : totalAccounts <= 10
                ? "Basic"
                : totalAccounts <= 15
                ? "Bronze"
                : totalAccounts <= 20
                ? "Silver"
                : totalAccounts <= 25
                ? "Gold"
                : totalAccounts <= 35
                ? "Diamond"
                : "Platinum";

            // ✅ New key: date-wise ledger
            s.dateWiseAccounts = dateWiseAccounts;
          }
        }

        if (s.BdSheet?.registration) s.registration = s.BdSheet.registration;
        if (s.BdSheet) delete s.BdSheet.registration;

        return s;
      })
    );

    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email"],
      raw: true,
    });

    return ReS(res, {
      count: formattedData.length,
      data: formattedData,
      managers,
    });
  } catch (err) {
    console.error("GET BD SHEET ERROR:", err);
    return ReE(res, err.message, 500);
  }
};

module.exports.getBdSheet = getBdSheet;


const getBdSheetByCategory = async (req, res) => {
  try {
    const { managerId, category } = req.query;

    if (!category) {
      return ReE(res, "category is required", 400);
    }

    let whereCondition = {};

    if (managerId) {
      const manager = await model.TeamManager.findOne({
        where: { id: managerId },
        attributes: ["name"],
      });

      if (manager && manager.name) {
        whereCondition.alloted = manager.name;
      } else {
        whereCondition.alloted = "__invalid__";
      }
    }

    const data = await model.StudentResume.findAll({
      where: whereCondition,
      attributes: [
        "id",
        "sr",
        "studentName",
        "mobileNumber",
        "emailId",
        "domain",
      ],
      include: [
        {
          model: model.BdSheet,
          required: false,
          attributes: {
            include: ["businessTask", "registration", "activeStatus"], // keep as is
          },
          order: [["id", "DESC"]],
        },
      ],
      order: [["id", "DESC"]],
    });

    const formattedData = await Promise.all(
      data.map(async (student) => {
        const s = student.toJSON();

        let businessTask = 0;

        if (s.mobileNumber) {
          // 🔥 Add userId + collegeName here also
          const user = await model.User.findOne({
            where: { phoneNumber: s.mobileNumber },
            attributes: [
              "subscriptionWallet",
              "id",            // << added
              "collegeName",   // << added
            ],
          });

          if (user) {
            const wallet = parseInt(user.subscriptionWallet || 0, 10);
            businessTask = wallet; // only subscriptionWallet

            // << NEW FIELDS >>
            s.userId = user.id;
            s.collegeName = user.collegeName;
          }
        }

        s.businessTask = businessTask;

        if (!businessTask || businessTask === 0) s.category = "not working";
        else if (businessTask >= 1 && businessTask <= 5) s.category = "Starter";
        else if (businessTask >= 6 && businessTask <= 10) s.category = "Basic";
        else if (businessTask >= 11 && businessTask <= 15) s.category = "Bronze";
        else if (businessTask >= 16 && businessTask <= 20) s.category = "Silver";
        else if (businessTask >= 21 && businessTask <= 25) s.category = "Gold";
        else if (businessTask >= 26 && businessTask <= 35) s.category = "Diamond";
        else if (businessTask >= 36 && businessTask <= 70) s.category = "Platinum";

        if (s.BdSheet && s.BdSheet.registration) {
          s.registration = s.BdSheet.registration;
        }
        if (s.BdSheet) {
          delete s.BdSheet.registration;
        }

        return s;
      })
    );

    const filteredData = formattedData.filter(
      (item) => item.category === category
    );

    const allCategories = [
      "not working",
      "Starter",
      "Basic",
      "Bronze",
      "Silver",
      "Gold",
      "Diamond",
      "Platinum",
    ];

    const categoryCounts = {};
    for (const cat of allCategories) {
      categoryCounts[cat] = formattedData.filter(
        (item) => item.category === cat
      ).length;
    }

    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email"],
      raw: true,
    });

    return ReS(res, {
      count: filteredData.length,
      data: filteredData,
      managers: managers,
      categoryCounts,
    });
  } catch (err) {
    console.log("GET BD SHEET CATEGORY ERROR:", err);
    return ReE(res, err.message, 500);
  }
};

module.exports.getBdSheetByCategory = getBdSheetByCategory;



// const getDashboardStats = async (req, res) => {
//   try {
//     const { managerId, startDate, endDate } = req.query;

//     // ---------------------------
//     // 1️⃣ Manager Validation
//     // ---------------------------
//     let manager;
//     if (managerId) {
//       manager = await model.TeamManager.findByPk(managerId);
//       if (!manager) return ReE(res, "Team Manager not found", 404);
//     }

//     // ---------------------------
//     // 2️⃣ Date Handling (DEFAULT = CURRENT MONTH → TODAY)
//     // ---------------------------
//     let fromDate, toDate;

//     if (startDate && endDate) {
//       fromDate = new Date(startDate);
//       fromDate.setHours(0, 0, 0, 0);

//       toDate = new Date(endDate);
//       toDate.setHours(23, 59, 59, 999);
//     } else {
//       const today = new Date();

//       fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
//       fromDate.setHours(0, 0, 0, 0);

//       toDate = new Date(today);
//       toDate.setHours(23, 59, 59, 999);
//     }

//     // ---------------------------
//     // 3️⃣ BD TARGET (TARGET NUMBERS)
//     // ---------------------------
//     const bdTargetData = await model.BdTarget.findAll({
//       where: {
//         ...(managerId ? { teamManagerId: managerId } : {}),
//         targetDate: { [Op.between]: [fromDate, toDate] },
//       },
//       attributes: ["internsAllocated", "internsActive", "accounts"],
//     });

//     let totalInternsAllocated = 0;
//     let totalInternsActive = 0;
//     let totalAccountsTarget = 0;

//     bdTargetData.forEach(t => {
//       totalInternsAllocated += Number(t.internsAllocated || 0);
//       totalInternsActive += Number(t.internsActive || 0);
//       totalAccountsTarget += Number(t.accounts || 0);
//     });

//     // ---------------------------
//     // 4️⃣ BD SHEET (DATE-RANGE BASED COUNTS)
//     // Only valid StudentResume and deduplicate by studentResumeId
//     // ---------------------------
//     const bdSheets = await model.BdSheet.findAll({
//       where: {
//         ...(managerId ? { teamManagerId: managerId } : {}),
//         startDate: { [Op.between]: [fromDate, toDate] },
//       },
//       attributes: ["id", "studentResumeId", "activeStatus"],
//       include: [
//         {
//           model: model.StudentResume,
//           required: true, // only valid StudentResume
//           attributes: ["mobileNumber", "alloted"], // 🔹 include alloted field
//           ...(managerId ? { where: { alloted: manager.name } } : {}), // 🔹 filter like getBdSheet
//         },
//       ],
//       order: [["id", "DESC"]],
//     });

//     // Deduplicate by studentResumeId (latest record only)
//     const latestByStudent = new Map();
//     bdSheets.forEach(sheet => {
//       if (!latestByStudent.has(sheet.studentResumeId)) {
//         latestByStudent.set(sheet.studentResumeId, sheet);
//       }
//     });

//     const uniqueSheets = Array.from(latestByStudent.values());

//     const totalInterns = uniqueSheets.length;

//     const totalActiveInterns = uniqueSheets.filter(
//       s => s.activeStatus?.toLowerCase() === "active"
//     ).length;

//     // ---------------------------
//     // 5️⃣ ACHIEVED ACCOUNTS (✔ ONLY subscriptionWallet)
//     // ---------------------------
//     let totalAccountsSheet = 0;

//     const mobileNumbers = [
//       ...new Set(uniqueSheets.map(s => s.StudentResume.mobileNumber).filter(Boolean)),
//     ];

//     if (mobileNumbers.length) {
//       const users = await model.User.findAll({
//         where: { phoneNumber: { [Op.in]: mobileNumbers } },
//         attributes: ["subscriptionWallet"],
//       });

//       users.forEach(u => {
//         totalAccountsSheet += Number(u.subscriptionWallet || 0);
//       });
//     }

//     // ---------------------------
//     // 6️⃣ FINAL RESPONSE
//     // ---------------------------
//     return ReS(res, {
//       bdTarget: {
//         totalInternsAllocated,
//         totalInternsActive,
//         totalAccounts: totalAccountsTarget,
//       },
//       bdSheet: {
//         totalInterns,
//         totalActiveInterns,
//         totalAccounts: totalAccountsSheet,
//       },
//       appliedFilters: {
//         managerId: managerId || "ALL",
//         startDate: fromDate.toLocaleDateString("en-CA"),
//         endDate: toDate.toLocaleDateString("en-CA"),
//       },
//     });

//   } catch (err) {
//     console.error("Dashboard Stats Error:", err);
//     return ReE(res, err.message, 500);
//   }
// };

// module.exports.getDashboardStats = getDashboardStats;



const getDashboardStats = async (req, res) => {
  try {
    const managerId = req.query.managerId;
    const { startDate, endDate } = req.query;

    // ---------------------------
    // Manager Filter
    // ---------------------------
    let teamManagerName = null;

    if (managerId) {
      const manager = await TeamManager.findByPk(managerId);
      if (!manager) return ReE(res, "Team Manager not found", 404);
      teamManagerName = manager.name;
    }

    // ---------------------------
    // DATE FILTER (BdTarget)
    // ---------------------------
    let targetDateFilter = {};
    if (startDate && endDate) {
      targetDateFilter = {
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn("DATE", Sequelize.col("targetDate")),
            ">=",
            startDate
          ),
          Sequelize.where(
            Sequelize.fn("DATE", Sequelize.col("targetDate")),
            "<=",
            endDate
          ),
        ],
      };
    }

    // ---------------------------
    // 1️⃣ BdTarget (TARGET DATA)
    // ---------------------------
    const bdTargetData = await BdTarget.findAll({
      where: {
        ...(teamManagerName ? { teamManagerId: managerId } : {}),
        ...(startDate && endDate ? targetDateFilter : {}),
      },
      attributes: ["internsAllocated", "internsActive", "accounts"],
    });

    let totalInternsAllocated = 0;
    let totalInternsActive = 0;
    let totalAccountsTarget = 0;

    bdTargetData.forEach((row) => {
      totalInternsAllocated += Number(row.internsAllocated) || 0;
      totalInternsActive += Number(row.internsActive) || 0;
      totalAccountsTarget += Number(row.accounts) || 0;
    });

    // ---------------------------
    // DATE FILTER (BdSheet)
    // ---------------------------
    let sheetDateFilter = {};
    if (startDate && endDate) {
      sheetDateFilter = {
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn("DATE", Sequelize.col("startDate")),
            ">=",
            startDate
          ),
          Sequelize.where(
            Sequelize.fn("DATE", Sequelize.col("startDate")),
            "<=",
            endDate
          ),
        ],
      };
    }

    // ---------------------------
    // 2️⃣ BdSheet (INTERNS DATA)
    // ---------------------------
    const bdSheetData = await BdSheet.findAll({
      where: {
        ...(teamManagerName ? { teamManagerId: managerId } : {}),
        ...(startDate && endDate ? sheetDateFilter : {}),
      },
      attributes: ["activeStatus"],
    });

    const totalInterns = bdSheetData.length;
    const totalActiveInterns = bdSheetData.filter(
      row => row.activeStatus?.toLowerCase() === "active"
    ).length;

    // ---------------------------
    // 3️⃣ ACHIEVED ACCOUNTS (FundsAudit)
    // ---------------------------
    let userIds = [];

    if (teamManagerName) {
      const statuses = await Status.findAll({
        where: { teamManager: teamManagerName },
        attributes: ["userId"],
      });
      userIds = statuses.map(s => s.userId);
    }

    let totalAccountsSheet = 0;

    if (userIds.length && startDate && endDate) {
      const fromDate = new Date(startDate);
      const toDate = new Date(endDate);
      toDate.setHours(23, 59, 59, 999); // ✅ FULL DAY FIX

      const accountsResult = await FundsAudit.sequelize.query(
        `
        SELECT COUNT(DISTINCT "userId") AS achieved_accounts
        FROM "FundsAudits"
        WHERE "userId" IN (:userIds)
          AND "hasPaid" = true
          AND "dateOfPayment" BETWEEN :start AND :end
        `,
        {
          replacements: {
            userIds,
            start: fromDate,
            end: toDate,
          },
          type: FundsAudit.sequelize.QueryTypes.SELECT,
        }
      );

      totalAccountsSheet = parseInt(accountsResult[0]?.achieved_accounts || 0);
    }

    // ---------------------------
    // FINAL RESPONSE (UNCHANGED)
    // ---------------------------
    return ReS(res, {
      bdTarget: {
        totalInternsAllocated,
        totalInternsActive,
        totalAccounts: totalAccountsTarget,
      },
      bdSheet: {
        totalInterns,
        totalAccounts: totalAccountsSheet,
        totalActiveInterns,
      },
      appliedFilters: {
        managerId: managerId || "ALL",
        startDate,
        endDate,
      },
    });

  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    return ReE(res, err.message, 500);
  }
};

module.exports.getDashboardStats = getDashboardStats;

// HARD-CODED RANGES (not stored in DB)
const RANGE_KEYS = ["1-10", "11-20", "21-30", "31-40", "41-50", "51-60", "61-70", "71-80", "81-90", "91-100","101-200","201-300","301-400","401-500","501-600","601+"];

// -----------------------------
// UPSERT RANGE AMOUNTS
// -----------------------------
const upsertRangeAmounts = async (req, res) => {
  try {
    const { managerId, incentiveAmounts, deductionAmounts } = req.body;

    if (!managerId) return ReE(res, "managerId is required", 400);

    // ---- Fetch record by managerId ----
    let target = await model.ManagerRanges.findOne({
      where: { teamManagerId: managerId },
    });

    // ---- Prepare cleaned JSON objects ----
    let cleanedIncentives = filterRangeAmounts(incentiveAmounts);
    let cleanedDeductions = filterRangeAmounts(deductionAmounts);

    // ---- UPDATE CASE ----
    if (target) {
      const updateData = {};

      if (Object.keys(cleanedIncentives).length > 0) {
        updateData.incentiveAmounts = {
          ...(target.incentiveAmounts || {}),
          ...cleanedIncentives,
        };
      }

      if (Object.keys(cleanedDeductions).length > 0) {
        updateData.deductionAmounts = {
          ...(target.deductionAmounts || {}),
          ...cleanedDeductions,
        };
      }

      await target.update(updateData);

      return ReS(res, {
        message: "Range amounts updated successfully",
        data: target,
      });
    }

    // ---- CREATE CASE ----
    const newData = {
      teamManagerId: managerId,
      incentiveAmounts: cleanedIncentives,
      deductionAmounts: cleanedDeductions,
    };

    const newTarget = await model.ManagerRanges.create(newData);

    return ReS(res, {
      message: "Range amounts created successfully",
      data: newTarget,
    });
  } catch (error) {
    console.log("UPSERT RANGE AMOUNTS ERROR:", error);
    return ReE(res, error.message, 500);
  }
};

// ---------------------------------------
// Helper: Only accept valid range → amount
// ---------------------------------------
function filterRangeAmounts(amountObject) {
  const output = {};

  if (!amountObject || typeof amountObject !== "object") return output;

  for (const range of RANGE_KEYS) {
    if (
      amountObject[range] !== undefined &&
      amountObject[range] !== null &&
      amountObject[range] !== ""
    ) {
      output[range] = Number(amountObject[range]);
    }
  }

  return output;
}

module.exports.upsertRangeAmounts = upsertRangeAmounts;

const getManagerRangeAmounts = async (req, res) => {
  try {
    const managerId = req.params.managerId || req.query.managerId;

    if (!managerId) return ReE(res, "managerId is required", 400);

    // Fetch the MOST RECENT ManagerRanges entry for this manager
    const sheet = await model.ManagerRanges.findOne({
      where: { teamManagerId: managerId },
      order: [["updatedAt", "DESC"]], // IMPORTANT: takes updated row
      attributes: ["incentiveAmounts", "deductionAmounts"],
    });

    // Prepare incentive and deduction objects with all ranges
    const prepareRanges = (amountObj) => {
      const output = {};
      for (const key of RANGE_KEYS) {
        output[key] = amountObj && amountObj[key] !== undefined ? amountObj[key] : null;
      }
      return output;
    };

    const incentiveAmounts = prepareRanges(sheet ? sheet.incentiveAmounts : {});
    const deductionAmounts = prepareRanges(sheet ? sheet.deductionAmounts : {});

    // ----------------------------
    //  FETCH ALL REGISTERED MANAGERS
    // ----------------------------
    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email"],
      raw: true,
    });

    return ReS(res, {
      message: "Manager range amounts fetched successfully",
      data: {
        managerId,
        incentiveAmounts,
        deductionAmounts,
      },

      // Only this line added
      managers: managers,
    });
  } catch (error) {
    console.log("GET MANAGER RANGE AMOUNTS ERROR:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getManagerRangeAmounts = getManagerRangeAmounts;



const getBdSheetByDateRange = async (req, res) => {
  try {
    let { teamManagerId, from, to } = req.query;

    const today = new Date();
    let sDate = from ? new Date(from) : new Date(today.getFullYear(), today.getMonth(), 1);
    let eDate = to ? new Date(to) : new Date(today.getFullYear(), today.getMonth() + 1, 0);

    let teamManagers = [];
    if (teamManagerId) {
      teamManagerId = parseInt(teamManagerId, 10);
      teamManagers = await model.TeamManager.findAll({ where: { id: teamManagerId } });
      if (!teamManagers.length) return ReE(res, "Team manager not found", 404);
    } else {
      teamManagers = await model.TeamManager.findAll();
    }

    const result = [];

    for (const manager of teamManagers) {
      const dateList = [];
      for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
        const cur = new Date(d);
        dateList.push({
          date: cur.toLocaleDateString("en-CA"),
          day: cur.toLocaleDateString("en-US", { weekday: "long" }),
        });
      }

      // Fetch targets
      const targets = await model.BdTarget.findAll({
        where: {
          teamManagerId: manager.id,
          targetDate: { [Op.between]: [sDate, eDate] },
        },
      });

      // Fetch sheet (achieved) - try both teamManagerId and tlAllocated
      let sheets = await model.BdSheet.findAll({
        where: {
          teamManagerId: manager.id,
          startDate: { [Op.between]: [sDate, eDate] },
        },
        attributes: ["startDate", "activeStatus", "businessTask"],
      });

      // If no results with teamManagerId, try with tlAllocated (manager name)
      if (sheets.length === 0) {
        sheets = await model.BdSheet.findAll({
          where: {
            tlAllocated: manager.name,
            startDate: { [Op.between]: [sDate, eDate] },
          },
          attributes: ["startDate", "activeStatus", "businessTask"],
        });
      }

      console.log(`Manager ${manager.name} (ID: ${manager.id}) has ${sheets.length} BdSheet entries between ${sDate} and ${eDate}`);
      if (sheets.length > 0) {
        console.log('Sample BdSheet entry:', {
          startDate: sheets[0].startDate,
          activeStatus: sheets[0].activeStatus,
          businessTask: sheets[0].businessTask
        });
      }

      const merged = dateList.map(d => {
        const target = targets.find(
          t => new Date(t.targetDate).toLocaleDateString("en-CA") === d.date
        );

        const sheetsForDate = sheets.filter(
          s => new Date(s.startDate).toLocaleDateString("en-CA") === d.date
        );

        // Total interns = all BdSheet entries for this date
        const totalInternsForDay = sheetsForDate.length;

        // Active interns = BdSheet entries with activeStatus = "active"
        const activeInternsForDay = sheetsForDate.filter(
          s => s.activeStatus?.toLowerCase() === "active"
        ).length;

        const achievedAccounts = sheetsForDate.reduce(
          (sum, s) => sum + (parseInt(s.businessTask) || 0),
          0
        );

        return {
          ...d,
          internsAllocated: target ? target.internsAllocated : 0,  // Target
          totalInterns: totalInternsForDay,                        // Achieved (all BdSheet entries)
          internsActive: target ? target.accounts : 0,             // Target
          activeInterns: activeInternsForDay,                      // Achieved (active status only)
          accounts: achievedAccounts,                              // Achieved (businessTask sum)
        };
      });

      // ✅ Calculate totals as sum across all days in the date range
      const totals = {
        internsAllocated: merged.reduce((sum, t) => sum + t.internsAllocated, 0),  // Total target for period
        totalInterns: merged.reduce((sum, t) => sum + t.totalInterns, 0),          // Total BdSheet entries
        internsActive: merged.reduce((sum, t) => sum + t.internsActive, 0),        // Total target for period
        activeInterns: merged.reduce((sum, t) => sum + t.activeInterns, 0),        // Total active entries
        accounts: merged.reduce((sum, t) => sum + t.accounts, 0),                  // Total achieved accounts
      };

      result.push({
        teamManagerId: manager.id,
        teamManagerName: manager.name,
        dates: merged,
        totals,
      });
    }

    return ReS(res, { success: true, data: result }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.getBdSheetByDateRange = getBdSheetByDateRange;

const getTargetVsAchieved = async (req, res) => {
  try {
    const { managerId, from, to } = req.query;

    if (!managerId || !from || !to) {
      return ReE(res, "managerId, from, and to are required", 400);
    }

    // ✅ Find manager
    const manager = await TeamManager.findByPk(managerId);
    if (!manager) return ReE(res, "Team Manager not found", 404);

    const teamManagerName = manager.name;

    // ✅ Get all users under this manager
    const statuses = await Status.findAll({
      where: { teamManager: teamManagerName },
      attributes: ["userId"],
    });
    const userIds = statuses.map(s => s.userId);

    // If no users, return empty
    if (!userIds.length) return ReS(res, {
      success: true,
      totals: { target: 0, achieved: 0, difference: 0, percentage: 0 },
      dateWise: []
    }, 200);

    // ✅ Adjust dates: make 'to' cover the full day
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999); // include full day

    // ✅ Fetch day-wise achieved counts from FundsAudit (using dateOfPayment)
    const achievedResults = await FundsAudit.sequelize.query(
      `
      SELECT DATE(f."dateOfPayment") AS paid_date,
             COUNT(DISTINCT f."userId") AS achieved
      FROM "FundsAudits" f
      WHERE f."userId" IN (:userIds)
        AND f."hasPaid" = true
        AND f."dateOfPayment" BETWEEN :from AND :to
      GROUP BY DATE(f."dateOfPayment")
      ORDER BY DATE(f."dateOfPayment");
      `,
      { replacements: { userIds, from: fromDate, to: toDate }, type: FundsAudit.sequelize.QueryTypes.SELECT }
    );

    // Build achieved map
    const dayWiseAchieved = {};
    achievedResults.forEach(r => dayWiseAchieved[r.paid_date] = parseInt(r.achieved));

    // ✅ Fetch targets from BdTarget
    const targets = await BdTarget.findAll({
      where: {
        teamManagerId: managerId,
        targetDate: { [Op.between]: [fromDate, toDate] }
      },
    });

    // Generate full date range
    const getDateRange = (from, to) => {
      const result = [];
      let current = new Date(from);
      const end = new Date(to);
      while (current <= end) {
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, "0");
        const dd = String(current.getDate()).padStart(2, "0");
        result.push(`${yyyy}-${mm}-${dd}`);
        current.setDate(current.getDate() + 1);
      }
      return result;
    };
    const allDates = getDateRange(fromDate, toDate);

    // Build date-wise comparison
    const dateWiseComparison = allDates.map(date => {
      const target = targets.find(t => new Date(t.targetDate).toISOString().split("T")[0] === date);
      const targetCount = target ? target.accounts : 0;
      const achievedCount = dayWiseAchieved[date] || 0;
      return {
        date,
        target: targetCount,
        achieved: achievedCount,
        difference: achievedCount - targetCount,
        percentage: targetCount > 0 ? ((achievedCount / targetCount) * 100).toFixed(2) : 0
      };
    });

    // Totals
    const totalTarget = dateWiseComparison.reduce((sum, d) => sum + d.target, 0);
    const totalAchieved = dateWiseComparison.reduce((sum, d) => sum + d.achieved, 0);
    const totalDifference = totalAchieved - totalTarget;
    const totalPercentage = totalTarget > 0 ? ((totalAchieved / totalTarget) * 100).toFixed(2) : 0;

    return ReS(res, {
      success: true,
      totals: { target: totalTarget, achieved: totalAchieved, difference: totalDifference, percentage: totalPercentage },
      dateWise: dateWiseComparison
    });

  } catch (err) {
    console.error("Target vs Achieved Error:", err);
    return ReE(res, err.message, 500);
  }
};

module.exports.getTargetVsAchieved = getTargetVsAchieved;

// const getTargetVsAchieved = async (req, res) => {
//   try {
//     const { managerId, from, to } = req.query;

//     if (!managerId || !from || !to) {
//       return ReE(res, "managerId, from, and to are required", 400);
//     }

//     // ---------------------------
//     // 1️⃣ Manager validation
//     // ---------------------------
//     const manager = await model.TeamManager.findByPk(managerId);
//     if (!manager) {
//       return ReE(res, "Team Manager not found", 404);
//     }

//     // ---------------------------
//     // 2️⃣ Date handling (LOCAL)
//     // ---------------------------
//     const fromDate = new Date(from);
//     fromDate.setHours(0, 0, 0, 0);

//     const toDate = new Date(to);
//     toDate.setHours(23, 59, 59, 999);

//     // ---------------------------
//     // 3️⃣ Fetch BdSheet + StudentResume
//     // ---------------------------
//     const sheets = await model.BdSheet.findAll({
//       where: {
//         teamManagerId: managerId,
//         startDate: {
//           [Op.between]: [fromDate, toDate],
//         },
//       },
//       attributes: ["startDate"],
//       include: [
//         {
//           model: model.StudentResume,
//           attributes: ["mobileNumber"],
//           required: true,
//         },
//       ],
//     });

//     // ---------------------------
//     // 4️⃣ Build date-wise achieved
//     // ---------------------------
//     const achievedByDate = {};

//     for (const sheet of sheets) {
//       if (!sheet.startDate) continue;

//       // ✅ SAFE: convert string → Date
//       const dateKey = new Date(sheet.startDate).toLocaleDateString("en-CA");

//       const mobile = sheet.StudentResume?.mobileNumber;
//       if (!mobile) continue;

//       const user = await model.User.findOne({
//         where: { phoneNumber: mobile },
//         attributes: ["subscriptionWallet"],
//       });

//       if (!user) continue;

//       const achievedValue = Number(user.subscriptionWallet || 0);

//       achievedByDate[dateKey] =
//         (achievedByDate[dateKey] || 0) + achievedValue;
//     }

//     // ---------------------------
//     // 5️⃣ Fetch targets
//     // ---------------------------
//     const targets = await model.BdTarget.findAll({
//       where: {
//         teamManagerId: managerId,
//         targetDate: {
//           [Op.between]: [fromDate, toDate],
//         },
//       },
//       attributes: ["targetDate", "accounts"],
//     });

//     const targetByDate = {};

//     for (const t of targets) {
//       if (!t.targetDate) continue;

//       const dateKey = new Date(t.targetDate).toLocaleDateString("en-CA");

//       targetByDate[dateKey] =
//         (targetByDate[dateKey] || 0) + Number(t.accounts || 0);
//     }

//     // ---------------------------
//     // 6️⃣ Generate full date range
//     // ---------------------------
//     const dateRange = [];
//     let current = new Date(fromDate);

//     while (current <= toDate) {
//       dateRange.push(current.toLocaleDateString("en-CA"));
//       current.setDate(current.getDate() + 1);
//     }

//     // ---------------------------
//     // 7️⃣ Date-wise comparison
//     // ---------------------------
//     const dateWise = dateRange.map(date => {
//       const target = targetByDate[date] || 0;
//       const achieved = achievedByDate[date] || 0;

//       return {
//         date,
//         target,
//         achieved,
//         difference: achieved - target,
//         percentage:
//           target > 0 ? ((achieved / target) * 100).toFixed(2) : "0.00",
//       };
//     });

//     // ---------------------------
//     // 8️⃣ Totals
//     // ---------------------------
//     const totalTarget = dateWise.reduce((sum, d) => sum + d.target, 0);
//     const totalAchieved = dateWise.reduce((sum, d) => sum + d.achieved, 0);
//     const totalDifference = totalAchieved - totalTarget;
//     const totalPercentage =
//       totalTarget > 0
//         ? ((totalAchieved / totalTarget) * 100).toFixed(2)
//         : "0.00";

//     return ReS(res, {
//       success: true,
//       totals: {
//         target: totalTarget,
//         achieved: totalAchieved,
//         difference: totalDifference,
//         percentage: totalPercentage,
//       },
//       dateWise,
//     });

//   } catch (err) {
//     console.error(" Target vs Achieved Error:", err);
//     console.error(" STACK:", err.stack);
//     return ReE(res, err.message, 500);
//   }
// };

// module.exports.getTargetVsAchieved = getTargetVsAchieved;


 const getBdTlLeaderboard = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return ReE(res, "from, to are required", 400);

    const teamManagers = await TeamManager.findAll({
      attributes: ["id", "name", "mobileNumber"],
    });

    if (!teamManagers.length) return ReE(res, "No team managers found", 404);

    // Adjust dates: make 'to' cover the full day
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999); // include full day

    const leaderboardData = [];

    for (const manager of teamManagers) {
      // Fetch BdSheet entries (try both teamManagerId and tlAllocated)
      let sheets = await BdSheet.findAll({
        where: {
          teamManagerId: manager.id,
          startDate: { [Op.between]: [fromDate, toDate] },
        },
        attributes: ["startDate", "activeStatus", "businessTask"],
      });

      if (sheets.length === 0) {
        sheets = await BdSheet.findAll({
          where: {
            tlAllocated: manager.name,
            startDate: { [Op.between]: [fromDate, toDate] },
          },
          attributes: ["startDate", "activeStatus", "businessTask"],
        });
      }

      const totalInterns = sheets.length;
      const activeInterns = sheets.filter(
        s => s.activeStatus && s.activeStatus.toLowerCase() === "active"
      ).length;

      // Achieved accounts using dateOfPayment
      const statuses = await Status.findAll({
        where: { teamManager: manager.name },
        attributes: ["userId"],
      });

      const userIds = statuses.map(s => s.userId);
      let achievedAccounts = 0;

      if (userIds.length) {
        const accountsResult = await FundsAudit.sequelize.query(
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
          {
            replacements: { userIds, from: fromDate, to: toDate },
            type: FundsAudit.sequelize.QueryTypes.SELECT,
          }
        );

        achievedAccounts = accountsResult.reduce(
          (sum, row) => sum + parseInt(row.unique_paid_users || 0),
          0
        );
      }

      // ---------------------------
      // Targets from BdTarget (UPDATED LOGIC)
      // ---------------------------
      const bdTargetData = await BdTarget.findAll({
        where: {
          teamManagerId: manager.id,
          targetDate: { [Op.between]: [fromDate, toDate] },
        },
        attributes: ["internsAllocated", "internsActive", "accounts"],
      });

      let internsAllocated = 0;
      let internsActive = 0;
      let accountsTarget = 0;

      bdTargetData.forEach((row) => {
        internsAllocated += Number(row.internsAllocated) || 0;
        internsActive += Number(row.internsActive) || 0; // Correct column now
        accountsTarget += Number(row.accounts) || 0;
      });

      const efficiency = accountsTarget > 0
        ? ((achievedAccounts / accountsTarget) * 100).toFixed(2)
        : 0;

      leaderboardData.push({
        tlName: manager.name,
        mobileNumber: manager.mobileNumber,
        internsAllocated,
        totalInterns,
        internsActive,
        activeInterns,
        accounts: achievedAccounts,
        accountsTarget,
        efficiency: parseFloat(efficiency),
      });
    }

    // Sort leaderboard
    leaderboardData.sort((a, b) => {
      if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
      if (b.accounts !== a.accounts) return b.accounts - a.accounts;
      return b.totalInterns - a.totalInterns;
    });

    const rankedData = leaderboardData.map((item, index) => ({ rank: index + 1, ...item }));

    return ReS(res, {
      success: true,
      leaderboard: rankedData,
      totalManagers: rankedData.length,
    });

  } catch (err) {
    console.error("BD TL Leaderboard Error:", err);
    return ReE(res, err.message, 500);
  }
};

module.exports.getBdTlLeaderboard = getBdTlLeaderboard;

// const getBdTlLeaderboard = async (req, res) => {
//   try {
//     const { from, to } = req.query;
//     if (!from || !to) return ReE(res, "from, to are required", 400);

//     const fromDate = new Date(from);
//     fromDate.setHours(0, 0, 0, 0);

//     const toDate = new Date(to);
//     toDate.setHours(23, 59, 59, 999);

//     const teamManagers = await model.TeamManager.findAll({
//       attributes: ["id", "name", "mobileNumber"],
//     });

//     if (!teamManagers.length) {
//       return ReE(res, "No team managers found", 404);
//     }

//     const leaderboardData = [];

//     for (const manager of teamManagers) {
//       // ---------------------------
//       // 1️⃣ BdSheet + StudentResume
//       // ---------------------------
//       let sheets = await model.BdSheet.findAll({
//         where: {
//           teamManagerId: manager.id,
//           startDate: { [Op.between]: [fromDate, toDate] },
//         },
//         attributes: ["activeStatus"],
//         include: [
//           {
//             model: model.StudentResume,
//             attributes: ["mobileNumber"],
//             required: true,
//           },
//         ],
//       });

//       // fallback (tlAllocated)
//       if (!sheets.length) {
//         sheets = await model.BdSheet.findAll({
//           where: {
//             tlAllocated: manager.name,
//             startDate: { [Op.between]: [fromDate, toDate] },
//           },
//           attributes: ["activeStatus"],
//           include: [
//             {
//               model: model.StudentResume,
//               attributes: ["mobileNumber"],
//               required: true,
//             },
//           ],
//         });
//       }

//       const totalInterns = sheets.length;

//       const activeInterns = sheets.filter(
//         s => s.activeStatus?.toLowerCase() === "active"
//       ).length;

//       // ---------------------------
//       // 2️⃣ ACHIEVED ACCOUNTS (✔ ONLY subscriptionWallet)
//       // ---------------------------
//       let achievedAccounts = 0;

//       const mobileNumbers = [
//         ...new Set(
//           sheets
//             .map(s => s.StudentResume?.mobileNumber)
//             .filter(Boolean)
//         ),
//       ];

//       if (mobileNumbers.length) {
//         const users = await model.User.findAll({
//           where: { phoneNumber: { [Op.in]: mobileNumbers } },
//           attributes: ["subscriptionWallet"],
//         });

//         users.forEach(u => {
//           achievedAccounts += Number(u.subscriptionWallet || 0);
//         });
//       }

//       // ---------------------------
//       // 3️⃣ TARGETS (BdTarget)
//       // ---------------------------
//       const bdTargetData = await model.BdTarget.findAll({
//         where: {
//           teamManagerId: manager.id,
//           targetDate: { [Op.between]: [fromDate, toDate] },
//         },
//         attributes: ["internsAllocated", "internsActive", "accounts"],
//       });

//       let internsAllocated = 0;
//       let internsActive = 0;
//       let accountsTarget = 0;

//       bdTargetData.forEach(t => {
//         internsAllocated += Number(t.internsAllocated || 0);
//         internsActive += Number(t.internsActive || 0);
//         accountsTarget += Number(t.accounts || 0);
//       });

//       const efficiency =
//         accountsTarget > 0
//           ? parseFloat(((achievedAccounts / accountsTarget) * 100).toFixed(2))
//           : 0;

//       // ---------------------------
//       // PUSH RESULT
//       // ---------------------------
//       leaderboardData.push({
//         tlName: manager.name,
//         mobileNumber: manager.mobileNumber,
//         internsAllocated,
//         totalInterns,
//         internsActive,
//         activeInterns,
//         accounts: achievedAccounts,
//         accountsTarget,
//         efficiency,
//       });
//     }

//     // ---------------------------
//     // SORT & RANK
//     // ---------------------------
//     leaderboardData.sort((a, b) => {
//       if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
//       if (b.accounts !== a.accounts) return b.accounts - a.accounts;
//       return b.totalInterns - a.totalInterns;
//     });

//     const rankedData = leaderboardData.map((item, index) => ({
//       rank: index + 1,
//       ...item,
//     }));

//     return ReS(res, {
//       success: true,
//       leaderboard: rankedData,
//       totalManagers: rankedData.length,
//     });

//   } catch (err) {
//     console.error("BD TL Leaderboard Error:", err);
//     return ReE(res, err.message, 500);
//   }
// };

// module.exports.getBdTlLeaderboard = getBdTlLeaderboard;



const getAccountTargetVsAchieved = async (req, res) => {
  try {
    const { managerId, from, to } = req.query;

    if (!managerId || !from || !to) {
      return ReE(res, "managerId, from, to are required", 400);
    }

    const manager = await model.TeamManager.findByPk(managerId);
    if (!manager) return ReE(res, "Team Manager not found", 404);

    // ----- ADJUST DATES TO COVER FULL DAY -----
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999); // include full 'to' day

    // ----- FETCH TARGETS -----
    const targets = await model.BdTarget.findAll({
      where: {
        teamManagerId: managerId,
        targetDate: { [Op.between]: [fromDate, toDate] },
      },
    });

    // Convert targets to map
    const targetMap = {};
    targets.forEach(t => {
      const date = new Date(t.targetDate).toISOString().slice(0, 10);
      targetMap[date] = t.accounts || 0;
    });

    // ----- FETCH ACHIEVED (via API) -----
    const phone = "+91" + manager.mobileNumber;
    const url = `https://lc8j8r2xza.execute-api.ap-south-1.amazonaws.com/prod/auth/getDailyReferralStatsByPhone?phone_number=${phone}&from_date=${from}&to_date=${to}`;
    const response = await axios.get(url);
    const referredUsers = response?.data?.result?.referred_users || [];

    const achievedMap = {};

    referredUsers.forEach(user => {
      user.daily_paid_counts.forEach(d => {
        achievedMap[d.date] = (achievedMap[d.date] || 0) + (parseInt(d.paid_count) || 0);
      });
    });

    // ----- BUILD FULL DATE RANGE -----
    const dates = [];
    let current = new Date(fromDate);
    const end = new Date(toDate);

    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }

    // ----- FINAL RESPONSE -----
    const result = dates.map(date => ({
      date,
      target: targetMap[date] || 0,
      achieved: achievedMap[date] || 0,
    }));

    return ReS(res, { success: true, data: result });

  } catch (err) {
    console.error(err);
    return ReE(res, err.message, 500);
  }
};

module.exports.getAccountTargetVsAchieved = getAccountTargetVsAchieved;



const getAccountsCountWithTargetSummary = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "from and to dates are required",
      });
    }

    // -----------------------------
    // 1️⃣ External API (ACHIEVED COUNT)
    // -----------------------------
    const paymentApiUrl = `https://lc8j8r2xza.execute-api.ap-south-1.amazonaws.com/prod/auth/getTotalPayments?from_date=${from}&to_date=${to}`;
    const response = await axios.get(paymentApiUrl);

    const payments = response.data.payments || [];

    const daily = payments.map((p) => ({
      date: p.date,
      accountsAchieved: Number(p.total_count) || 0,
      accountsTarget: 0, // 👈 will be filled next
    }));

    const totalAccountsAchieved = daily.reduce(
      (sum, d) => sum + d.accountsAchieved,
      0
    );

    // -----------------------------
    // 2️⃣ BD TARGET (DATE WISE – ALL MANAGERS)
    // -----------------------------
    const bdTargets = await model.BdTarget.findAll({
      where: {
        targetDate: {
          [Op.between]: [from, to],
        },
      },
      attributes: [
        "targetDate",
        [model.sequelize.fn("SUM", model.sequelize.col("accounts")), "accounts"],
      ],
      group: ["targetDate"],
      raw: true,
    });

    // Create date -> target map
    const targetByDate = {};
    bdTargets.forEach((t) => {
      const date = new Date(t.targetDate).toISOString().slice(0, 10);
      targetByDate[date] = Number(t.accounts) || 0;
    });

    // Merge target into daily achieved
    daily.forEach((d) => {
      d.accountsTarget = targetByDate[d.date] || 0;
    });

    const totalAccountsTarget = Object.values(targetByDate).reduce(
      (sum, v) => sum + v,
      0
    );

    // -----------------------------
    // 3️⃣ Final Response
    // -----------------------------
    return res.status(200).json({
      success: true,
      from,
      to,
      daily,
      totals: {
        totalAccountsAchieved,
        totalAccountsTarget,
        difference: totalAccountsAchieved - totalAccountsTarget,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports.getAccountsCountWithTargetSummary =
  getAccountsCountWithTargetSummary;
