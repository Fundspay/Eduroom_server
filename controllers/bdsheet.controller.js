"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, Sequelize } = require("sequelize");
const axios = require("axios");
const { TeamManager, BdTarget , Status,FundsAudit } = require("../models");

const upsertBdSheet = async (req, res) => {
  try {
    const { studentResumeId } = req.body;
    if (!studentResumeId) return ReE(res, "studentResumeId is required", 400);

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
      where: { studentResumeId },
    });

    if (sheet) {
      const updateFields = filterUpdateFields(req.body, sheet);

      await sheet.update(updateFields);
      return ReS(res, { message: "BdSheet updated successfully", data: sheet });
    }

    // CREATE
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

// Helper function
function filterUpdateFields(reqBody, existingSheet) {
  const allowed = {};

  for (const key of Object.keys(reqBody)) {
    const incoming = reqBody[key];

    if (incoming === undefined || incoming === null) continue;

    if (
      ["day1", "day2", "day3", "day4", "day5", "day6", "day7"].includes(key)
    ) {
      if (typeof incoming === "object" && !Array.isArray(incoming)) {
        if (Object.keys(incoming).length === 0) continue;
      }

      allowed[key] = {
        ...existingSheet[key],
        ...incoming,
      };
      continue;
    }

    allowed[key] = incoming;
  }

  return allowed;
}

module.exports.upsertBdSheet = upsertBdSheet;

const getBdSheet = async (req, res) => {
  try {
    const { resumeId, managerId } = req.query;

    let whereCondition = {};

    if (resumeId) {
      whereCondition.id = resumeId;
    }

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
        "collegeName",
      ],
      include: [
        {
          model: model.BdSheet,
          required: false,
          attributes: {
            include: ["businessTask", "registration", "activeStatus"],
          },
          limit: 1,
          order: [["id", "DESC"]],
        },
      ],
      order: [["id", "DESC"]],
    });

    const formattedData = await Promise.all(
      data.map(async (student) => {
        const s = student.toJSON();

        if (Array.isArray(s.BdSheet)) {
          s.BdSheet = s.BdSheet[0] || null;
        }

        // 🔥 Fetch user for wallet + userId + collegeName
        if (s.mobileNumber) {
          const user = await model.User.findOne({
            where: { phoneNumber: s.mobileNumber },
            attributes: [
              "subscriptionWallet",
              "subscriptiondeductedWallet",
              "id",              // << added
              "collegeName",     // << added
            ],
          });

          if (user) {
            const wallet = parseInt(user.subscriptionWallet || 0, 10);
            const deducted = parseInt(
              user.subscriptiondeductedWallet || 0,
              10
            );

            const businessTask = wallet + deducted;
            s.businessTask = businessTask;

            // NEW FIELDS
            s.userId = user.id;              // << added
            s.collegeName = user.collegeName; // << added

            if (!businessTask || businessTask === 0) s.category = "not working";
            else if (businessTask >= 1 && businessTask <= 5)
              s.category = "Starter";
            else if (businessTask >= 6 && businessTask <= 10)
              s.category = "Basic";
            else if (businessTask >= 11 && businessTask <= 15)
              s.category = "Bronze";
            else if (businessTask >= 16 && businessTask <= 20)
              s.category = "Silver";
            else if (businessTask >= 21 && businessTask <= 25)
              s.category = "Gold";
            else if (businessTask >= 26 && businessTask <= 35)
              s.category = "Diamond";
            else if (businessTask >= 36 && businessTask <= 70)
              s.category = "Platinum";
          }
        }

        if (s.BdSheet && s.BdSheet.registration) {
          s.registration = s.BdSheet.registration;
        }

        if (s.BdSheet) {
          delete s.BdSheet.registration;
        }

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
      managers: managers,
    });
  } catch (err) {
    console.log("GET BD SHEET ERROR:", err);
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
            include: ["businessTask", "registration", "activeStatus"],
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
              "subscriptiondeductedWallet",
              "id",            // << added
              "collegeName",   // << added
            ],
          });

          if (user) {
            const wallet = parseInt(user.subscriptionWallet || 0, 10);
            const deducted = parseInt(user.subscriptiondeductedWallet || 0, 10);
            businessTask = wallet + deducted;

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


const getDashboardStats = async (req, res) => {
  try {
    const managerId = req.query.managerId;
    const { startDate, endDate } = req.query;

    // ---------------------------
    // FIXED DATE FILTER (BdTarget)
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

    const managerFilter = managerId
      ? { teamManagerId: parseInt(managerId, 10) }
      : {};

    // ---------------------------
    // 1️⃣ BdTarget stats
    // ---------------------------
    const bdTargetData = await model.BdTarget.findAll({
      where: {
        ...managerFilter,
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
    // FIXED DATE FILTER (BdSheet)
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

    const bdSheetData = await model.BdSheet.findAll({
      where: {
        ...managerFilter,
        ...(startDate && endDate ? sheetDateFilter : {}),
      },
      attributes: ["businessTask", "activeStatus"],
    });

    let totalInterns = bdSheetData.length;
    let totalAccountsSheet = 0;
    let totalActiveInterns = 0;

    bdSheetData.forEach((row) => {
      const taskNum = parseInt(row.businessTask);
      if (!isNaN(taskNum)) totalAccountsSheet += taskNum;

      if (row.activeStatus?.toLowerCase() === "active") {
        totalActiveInterns += 1;
      }
    });

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
    let sDate, eDate;

    if (from && to) {
      sDate = new Date(from);
      eDate = new Date(to);
    } else {
      sDate = new Date(today.getFullYear(), today.getMonth(), 1);
      eDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

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
      // Generate date list
      const dateList = [];
      for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
        const cur = new Date(d);
        dateList.push({
          date: cur.toLocaleDateString("en-CA"),
          day: cur.toLocaleDateString("en-US", { weekday: "long" }),
          internsAllocated: 0,
          internsActive: 0,
          activeInterns: 0,
          accounts: 0,
        });
      }

      // Fetch existing targets
      const existingTargets = await model.BdTarget.findAll({
        where: {
          teamManagerId: manager.id,
          targetDate: { [Op.between]: [sDate, eDate] },
        },
      });

      // Fetch sheet data
      const sheetData = await model.BdSheet.findAll({
        where: {
          teamManagerId: manager.id,
          startDate: { [Op.between]: [sDate, eDate] },
        },
        attributes: ["startDate", "activeStatus", "businessTask"],
      });

      // Calculate total interns exactly like getDashboardStats
      const totalInterns = sheetData.length;

      // Merge targets and sheet data per date
      const merged = dateList.map((d) => {
        const target = existingTargets.find(
          (t) => new Date(t.targetDate).toLocaleDateString("en-CA") === d.date
        );

        const sheetsForDate = sheetData.filter(
          (s) => new Date(s.startDate).toLocaleDateString("en-CA") === d.date
        );

        const activeCount = sheetsForDate.filter(
          (s) => s.activeStatus?.toLowerCase() === "active"
        ).length;

        const accountsCount = sheetsForDate.reduce(
          (sum, s) => sum + (parseInt(s.businessTask) || 0),
          0
        );

        return {
          ...d,
          internsAllocated: target ? target.internsAllocated : 0,
          internsActive: target ? target.internsActive : 0,
          activeInterns: activeCount,
          accounts: target ? target.accounts : accountsCount,
        };
      });

      // Totals
      const totals = {
        totalInterns, // NEW: total interns in sheetData
        internsAllocated: merged.reduce((sum, t) => sum + t.internsAllocated, 0),
        internsActive: merged.reduce((sum, t) => sum + t.internsActive, 0),
        activeInterns: merged.reduce((sum, t) => sum + t.activeInterns, 0),
        accounts: merged.reduce((sum, t) => sum + t.accounts, 0),
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

    // ✅ Fetch day-wise achieved counts from FundsAudit
    const achievedResults = await FundsAudit.sequelize.query(
      `
      SELECT DATE(f."createdAt") AS paid_date,
             COUNT(DISTINCT f."userId") AS achieved
      FROM "FundsAudits" f
      WHERE f."userId" IN (:userIds)
        AND f."hasPaid" = true
        AND f."createdAt" BETWEEN :from AND :to
      GROUP BY DATE(f."createdAt")
      ORDER BY DATE(f."createdAt");
      `,
      { replacements: { userIds, from, to }, type: FundsAudit.sequelize.QueryTypes.SELECT }
    );

    // Build achieved map
    const dayWiseAchieved = {};
    achievedResults.forEach(r => dayWiseAchieved[r.paid_date] = parseInt(r.achieved));

    // ✅ Fetch targets from BdTarget
    const targets = await BdTarget.findAll({
      where: {
        teamManagerId: managerId,
        targetDate: { [Op.between]: [from, to] }
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
    const allDates = getDateRange(from, to);

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

const getBdTlLeaderboard = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return ReE(res, "from, to are required", 400);

    const teamManagers = await TeamManager.findAll({
      attributes: ["id", "name", "mobileNumber"],
    });

    if (!teamManagers.length) return ReE(res, "No team managers found", 404);

    const leaderboardData = [];

    for (const manager of teamManagers) {
      // Users under this manager
      const statuses = await Status.findAll({
        where: { teamManager: manager.name },
        attributes: ["userId"],
      });
      const userIds = statuses.map(s => s.userId);

      // Achieved counts
      let totalAchieved = 0;
      if (userIds.length) {
        const results = await FundsAudit.sequelize.query(
          `
          SELECT COUNT(DISTINCT "userId") AS achieved
          FROM "FundsAudits"
          WHERE "userId" IN (:userIds)
            AND "hasPaid" = true
            AND "createdAt" BETWEEN :from AND :to
          `,
          {
            replacements: { userIds, from, to },
            type: FundsAudit.sequelize.QueryTypes.SELECT,
          }
        );
        totalAchieved = results[0]?.achieved || 0;
      }

      // Targets
      const targets = await BdTarget.findAll({
        where: {
          teamManagerId: manager.id,
          targetDate: { [Op.between]: [from, to] },
        },
      });
      const totalTeamTarget = targets.reduce((sum, t) => sum + (t.accounts || 0), 0);
      const totalTeamAllocated = targets.reduce((sum, t) => sum + (t.internsAllocated || 0), 0);
      const totalTeamActive = targets.reduce((sum, t) => sum + (t.internsActive || 0), 0);

      const efficiency = totalTeamTarget > 0
        ? ((totalAchieved / totalTeamTarget) * 100).toFixed(2)
        : 0;

      leaderboardData.push({
        tlName: manager.name,
        mobileNumber: manager.mobileNumber,
        totalTeamAllocated,
        totalTeamActive,
        accountTarget: totalTeamTarget,
        accountAchieved: totalAchieved,
        efficiency: parseFloat(efficiency),
      });
    }

    // Sort by efficiency
    leaderboardData.sort((a, b) => b.efficiency - a.efficiency);
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


const getAccountTargetVsAchieved = async (req, res) => {
  try {
    const { managerId, from, to } = req.query;

    if (!managerId || !from || !to) {
      return ReE(res, "managerId, from, to are required", 400);
    }

    const manager = await model.TeamManager.findByPk(managerId);
    if (!manager) return ReE(res, "Team Manager not found", 404);

    // ----- FETCH TARGETS -----
    const targets = await model.BdTarget.findAll({
      where: {
        teamManagerId: managerId,
        targetDate: { [Op.between]: [from, to] }
      }
    });

    // Convert targets to map
    const targetMap = {};
    targets.forEach(t => {
      const date = new Date(t.targetDate).toISOString().slice(0, 10);
      targetMap[date] = t.accounts || 0;
    });

    // ----- FETCH ACHIEVED -----
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

    // ----- BUILD DATE RANGE -----
    const dates = [];
    let current = new Date(from);
    const end = new Date(to);

    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }

    // ----- FINAL RESPONSE -----
    const result = dates.map(date => ({
      date,
      target: targetMap[date] || 0,
      achieved: achievedMap[date] || 0
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
    }));

    const totalAccountsAchieved = daily.reduce(
      (sum, d) => sum + d.accountsAchieved,
      0
    );

    // -----------------------------
    // 2️⃣ BD TARGET (TOTAL ONLY)
    // -----------------------------
    const bdTargets = await model.BdTarget.findAll({
      where: {
        targetDate: {
          [Op.between]: [from, to],
        },
      },
      attributes: ["accounts"],
    });

    const totalAccountsTarget = bdTargets.reduce(
      (sum, t) => sum + (Number(t.accounts) || 0),
      0
    );

    // -----------------------------
    // 3️⃣ Final Response
    // -----------------------------
    return res.status(200).json({
      success: true,
      from,
      to,
      daily, // optional but useful
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