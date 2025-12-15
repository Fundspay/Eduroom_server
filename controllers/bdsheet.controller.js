"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, Sequelize } = require("sequelize");


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


function formatDateLocal(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const getBdSheetByDateRange = async (req, res) => {
  try {
    let { managerId, from, to } = req.query;

    if (!from || !to) return ReE(res, "from and to dates are required", 400);

    const sDate = new Date(from + "T00:00:00");
    const eDate = new Date(to + "T23:59:59");

    // Generate daily list
    const dateList = [];
    for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
      const cur = new Date(d);
      dateList.push({
        date: formatDateLocal(cur), // YYYY-MM-DD
        day: cur.toLocaleDateString("en-US", { weekday: "long" }),
        internsAllocated: 0,
        internsActive: 0,
      });
    }

    // Map for counting
    const dateMap = {};
    dateList.forEach((d) => (dateMap[d.date] = { ...d }));

    // Build BdSheet filter
    const whereBdSheet = { activeStatus: "active" };
    if (managerId) whereBdSheet.teamManagerId = parseInt(managerId, 10);

    // Fetch students with active BdSheets
    const students = await model.StudentResume.findAll({
      include: [
        {
          model: model.BdSheet,
          as: "BdSheets", // default plural alias
          required: true,
          where: whereBdSheet,
          attributes: ["activeStatus", "teamManagerId", "startDate"],
        },
      ],
      attributes: ["id"],
    });

    // Count per day
    students.forEach((student) => {
      student.BdSheets.forEach((sheet) => {
        if (!sheet.startDate) return;
        const dateKey = formatDateLocal(new Date(sheet.startDate));
        if (dateMap[dateKey]) {
          dateMap[dateKey].internsAllocated += 1;
          dateMap[dateKey].internsActive += 1;
        }
      });
    });

    const merged = Object.values(dateMap);

    // Totals
    const totals = {
      internsAllocated: merged.reduce((sum, t) => sum + t.internsAllocated, 0),
      internsActive: merged.reduce((sum, t) => sum + t.internsActive, 0),
    };

    return ReS(res, { success: true, dates: merged, totals }, 200);
  } catch (err) {
    console.log("GET BD SHEET DATE RANGE ERROR:", err);
    return ReE(res, err.message, 500);
  }
};

module.exports.getBdSheetByDateRange = getBdSheetByDateRange;