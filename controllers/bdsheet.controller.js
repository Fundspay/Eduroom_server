"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, Sequelize } = require("sequelize");
const axios = require("axios");


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

"use strict";

const { Op } = require("sequelize");
const model = require("../models");

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
          activeInterns: 0, // Track active interns
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

      // Fetch sheet data for active status
      const sheetData = await model.BdSheet.findAll({
        where: {
          teamManagerId: manager.id,
          startDate: { [Op.between]: [sDate, eDate] },
        },
        attributes: ["startDate", "activeStatus", "businessTask"],
      });

      // Merge
      const merged = dateList.map((d) => {
        const target = existingTargets.find((t) => new Date(t.targetDate).toLocaleDateString("en-CA") === d.date);
        const sheetsForDate = sheetData.filter((s) => new Date(s.startDate).toLocaleDateString("en-CA") === d.date);

        const activeCount = sheetsForDate.filter((s) => s.activeStatus?.toLowerCase() === "active").length;
        const accountsCount = sheetsForDate.reduce((sum, s) => sum + (parseInt(s.businessTask) || 0), 0);

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
      return ReE(res, "managerId, from, to are required", 400);
    }

    const manager = await model.TeamManager.findByPk(managerId);
    if (!manager) return ReE(res, "Team Manager not found", 404);

    // Fetch targets from database
    const sDate = new Date(from);
    const eDate = new Date(to);

    const targets = await model.BdTarget.findAll({
      where: {
        teamManagerId: managerId,
        targetDate: { [Op.between]: [sDate, eDate] },
      },
    });

    // Fetch achieved counts from referral API
    const phone = "+91" + manager.mobileNumber;
    const url = `https://lc8j8r2xza.execute-api.ap-south-1.amazonaws.com/prod/auth/getDailyReferralStatsByPhone?phone_number=${phone}&from_date=${from}&to_date=${to}`;

    const response = await axios.get(url);
    const data = response.data;

    if (!data?.result?.referred_users) {
      return ReE(res, "Invalid API response from referral service", 500);
    }

    const referredUsers = data.result.referred_users;

    // ----- DATE-WISE ACHIEVED COUNT -----
    const dateWiseAchieved = {};

    referredUsers.forEach(user => {
      user.daily_paid_counts.forEach(d => {
        const date = d.date;
        const paidCount = parseInt(d.paid_count);

        if (!dateWiseAchieved[date]) dateWiseAchieved[date] = 0;
        dateWiseAchieved[date] += paidCount;
      });
    });

    // ----- GENERATE FULL DATE RANGE -----
    function getDateRange(from, to) {
      const start = new Date(from);
      const end = new Date(to);
      const result = [];

      let current = new Date(start.getFullYear(), start.getMonth(), start.getDate());

      while (current <= end) {
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, "0");
        const dd = String(current.getDate()).padStart(2, "0");
        result.push(`${yyyy}-${mm}-${dd}`);
        current.setDate(current.getDate() + 1);
      }

      return result;
    }

    const allDates = getDateRange(from, to);

    // ----- BUILD DATE-WISE COMPARISON ARRAY -----
    const dateWiseComparison = allDates.map(date => {
      const target = targets.find(t => {
        const tDate = new Date(t.targetDate).toLocaleDateString("en-CA");
        return tDate === date;
      });

      const targetCount = target ? target.accounts : 0;
      const achievedCount = dateWiseAchieved[date] || 0;

      return {
        date,
        target: targetCount,
        achieved: achievedCount,
        difference: achievedCount - targetCount,
        percentage: targetCount > 0 ? ((achievedCount / targetCount) * 100).toFixed(2) : 0
      };
    });

    // ----- TOTALS -----
    const totalTarget = dateWiseComparison.reduce((sum, d) => sum + d.target, 0);
    const totalAchieved = dateWiseComparison.reduce((sum, d) => sum + d.achieved, 0);
    const totalDifference = totalAchieved - totalTarget;
    const totalPercentage = totalTarget > 0 ? ((totalAchieved / totalTarget) * 100).toFixed(2) : 0;

    return ReS(res, {
      success: true,
      totals: {
        target: totalTarget,
        achieved: totalAchieved,
        difference: totalDifference,
        percentage: totalPercentage
      },
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

    if (!from || !to) {
      return ReE(res, "from, to are required", 400);
    }

    // Fetch all team managers
    const teamManagers = await model.TeamManager.findAll({
      attributes: ['id', 'name', 'mobileNumber'],
      where: {
        // Add any conditions if needed, e.g., isActive: true
      }
    });

    if (!teamManagers || teamManagers.length === 0) {
      return ReE(res, "No team managers found", 404);
    }

    const sDate = new Date(from);
    const eDate = new Date(to);

    const leaderboardData = [];

    // Process each team manager
    for (const manager of teamManagers) {
      try {
        // Fetch targets from database
        const targets = await model.BdTarget.findAll({
          where: {
            teamManagerId: manager.id,
            targetDate: { [Op.between]: [sDate, eDate] },
          },
        });

        // Calculate total team allocated and active
        const totalTeamAllocated = targets.reduce((sum, t) => sum + (t.internsAllocated || 0), 0);
        const totalTeamActive = targets.reduce((sum, t) => sum + (t.internsActive || 0), 0);
        const totalTeamTarget = targets.reduce((sum, t) => sum + (t.accounts || 0), 0);

        // Fetch achieved counts from referral API
        const phone = "+91" + manager.mobileNumber;
        const url = `https://lc8j8r2xza.execute-api.ap-south-1.amazonaws.com/prod/auth/getDailyReferralStatsByPhone?phone_number=${phone}&from_date=${from}&to_date=${to}`;

        const response = await axios.get(url);
        const data = response.data;

        let totalAchieved = 0;

        if (data?.result?.referred_users) {
          const referredUsers = data.result.referred_users;

          // Calculate total achieved (paid count)
          referredUsers.forEach(user => {
            user.daily_paid_counts.forEach(d => {
              totalAchieved += parseInt(d.paid_count) || 0;
            });
          });
        }

        // Calculate efficiency percentage
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
          efficiency: parseFloat(efficiency)
        });

      } catch (error) {
        console.error(`Error processing manager ${manager.id}:`, error.message);
        // Continue with other managers even if one fails
        leaderboardData.push({
          tlName: manager.name,
          mobileNumber: manager.mobileNumber,
          totalTeamAllocated: 0,
          totalTeamActive: 0,
          accountTarget: 0,
          accountAchieved: 0,
          efficiency: 0,
          error: "Data fetch failed"
        });
      }
    }

    // Sort by efficiency (descending) - Rank 1 = highest efficiency
    leaderboardData.sort((a, b) => b.efficiency - a.efficiency);

    // Add rank
    const rankedData = leaderboardData.map((item, index) => ({
      rank: index + 1,
      ...item
    }));

    return ReS(res, {
      success: true,
      leaderboard: rankedData,
      totalManagers: rankedData.length
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
