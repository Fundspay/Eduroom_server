"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

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

    // Filter by resumeId
    if (resumeId) {
      whereCondition.id = resumeId;
    }

    // Filter by managerId → match alloted with manager name
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

    // Move registration out of BdSheet to top-level + add real-time businessTask + category
    const formattedData = await Promise.all(
      data.map(async (student) => {
        const s = student.toJSON();

        // Real-Time businessTask + category logic
        if (s.mobileNumber) {
          const user = await model.User.findOne({
            where: { phoneNumber: s.mobileNumber },
            attributes: ["subscriptionWallet", "subscriptiondeductedWallet"],
          });

          if (user) {
            const wallet = parseInt(user.subscriptionWallet || 0, 10);
            const deducted = parseInt(user.subscriptiondeductedWallet || 0, 10);

            const businessTask = wallet + deducted;
            s.businessTask = businessTask;

            // Category calculation
            if (!businessTask || businessTask === 0) s.category = "not working";
            else if (businessTask >= 1 && businessTask <= 5) s.category = "Starter";
            else if (businessTask >= 6 && businessTask <= 10) s.category = "Basic";
            else if (businessTask >= 11 && businessTask <= 15) s.category = "Bronze";
            else if (businessTask >= 16 && businessTask <= 20) s.category = "Silver";
            else if (businessTask >= 21 && businessTask <= 25) s.category = "Gold";
            else if (businessTask >= 26 && businessTask <= 35) s.category = "Diamond";
            else if (businessTask >= 36 && businessTask <= 70) s.category = "Platinum";
          }
        }

        // Move registration out of BdSheet
        if (s.BdSheet && s.BdSheet.registration) {
          s.registration = s.BdSheet.registration;
        }

        if (s.BdSheet) {
          delete s.BdSheet.registration;
        }

        return s;
      })
    );

    // Fetch all managers
    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email"],
      raw: true,
    });

    return ReS(res, { 
      count: formattedData.length, 
      data: formattedData,
      managers: managers
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

    let whereCondition = {}; // for StudentResume
    let bdWhere = { category }; // for BdSheet

    // ---------------------------
    // Manager filter (same as your getBdSheet)
    // ---------------------------
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

    // ---------------------------
    // Fetch student + BdSheet (with category filter)
    // ---------------------------
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
          required: true, // we must have category match
          attributes: {
            include: ["businessTask", "registration"],
          },
          where: bdWhere,
          order: [["id", "DESC"]],
        },
      ],
      order: [["id", "DESC"]],
    });

    // Same formatting as original getBdSheet
    const formattedData = data.map((student) => {
      const s = student.toJSON();

      if (s.BdSheet && s.BdSheet.registration) {
        s.registration = s.BdSheet.registration;
      }

      if (s.BdSheet) {
        delete s.BdSheet.registration;
      }

      return s;
    });

    // ---------------------------
    // Counts Per Category (ADDED) — using same manager filter if present
    // ---------------------------
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
    const managerAlloted = whereCondition.alloted; // undefined if no manager filter

    for (const cat of allCategories) {
      if (managerAlloted) {
        // count BdSheet rows for this category where the related StudentResume.alloted = managerName
        categoryCounts[cat] = await model.BdSheet.count({
          where: { category: cat },
          include: [
            {
              model: model.StudentResume,
              where: { alloted: managerAlloted },
              attributes: [], // not needed
              required: true,
            },
          ],
          distinct: true, // ✅ ensures unique BdSheet rows
          col: "id",      // ✅ count by BdSheet.id
        });
      } else {
        // no manager filter — count across all BdSheets
        categoryCounts[cat] = await model.BdSheet.count({
          where: { category: cat },
          distinct: true, // ✅ ensures unique BdSheet rows
          col: "id",      // ✅ count by BdSheet.id
        });
      }
    }

    // ---------------------------
    // Fetch managers list
    // ---------------------------
    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email"],
      raw: true,
    });

    return ReS(res, {
      count: formattedData.length,
      data: formattedData,
      managers: managers,
      categoryCounts, // <-- only fixed counts
    });

  } catch (err) {
    console.log("GET BD SHEET CATEGORY ERROR:", err);
    return ReE(res, err.message, 500);
  }
};

module.exports.getBdSheetByCategory = getBdSheetByCategory;


const getDashboardStats = async (req, res) => {
  try {
    // ---------------------------
    // Extract query params
    // ---------------------------
    const managerId = req.query.managerId;
    const { startDate, endDate } = req.query;

    // ---------------------------
    // Filters for BdTarget
    // ---------------------------
    let targetDateFilter = {};
    if (startDate && endDate) {
      targetDateFilter = {
        targetDate: {
          [Op.between]: [startDate, endDate],
        },
      };
    }

    const managerFilter = managerId ? { teamManagerId: parseInt(managerId) } : {};

    // ---------------------------
    // 1️⃣ BdTarget stats
    // ---------------------------
    const bdTargetData = await model.BdTarget.findAll({
      where: {
        ...managerFilter,
        ...targetDateFilter,
      },
      attributes: ["internsAllocated", "internsActive", "accounts"],
    });

    let totalInternsAllocated = 0;
    let totalInternsActive = 0;
    let totalAccountsTarget = 0;

    bdTargetData.forEach((row) => {
      totalInternsAllocated += row.internsAllocated;
      totalInternsActive += row.internsActive;
      totalAccountsTarget += row.accounts;
    });

    // ---------------------------
    // 2️⃣ BdSheet stats
    // ---------------------------
    let sheetDateFilter = {};
    if (startDate && endDate) {
      sheetDateFilter = {
        startDate: { [Op.gte]: startDate },
        endDate: { [Op.lte]: endDate },
      };
    }

    const bdSheetData = await model.BdSheet.findAll({
      where: {
        ...managerFilter,
        ...sheetDateFilter,
      },
      attributes: ["businessTask", "activeStatus"],
    });

    let totalInterns = bdSheetData.length;
    let totalAccountsSheet = 0;
    let totalActiveInterns = 0;

    bdSheetData.forEach((row) => {
      // sum businessTask (convert string to number, ignore if invalid)
      const taskNum = parseInt(row.businessTask);
      if (!isNaN(taskNum)) totalAccountsSheet += taskNum;

      // count active interns
      if (row.activeStatus && row.activeStatus.toLowerCase() === "active") {
        totalActiveInterns += 1;
      }
    });

    // ---------------------------
    // FINAL RESPONSE
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
    return ReE(res, err.message, 500);
  }
};

module.exports.getDashboardStats = getDashboardStats;





