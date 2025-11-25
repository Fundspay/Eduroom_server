"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

const upsertBdSheet = async (req, res) => {
  try {
    const { studentResumeId } = req.body;
    if (!studentResumeId) return ReE(res, "studentResumeId is required", 400);

    // ---- FETCH RESUME (this was missing - caused "resume is not defined") ----
    const resume = await model.StudentResume.findOne({
      where: { id: studentResumeId },
    });

    // AUTO-FILL businessTask & registration
    if (resume) {
      const user = await model.User.findOne({
        where: { phoneNumber: resume.mobileNumber },
      });

      if (user) {
        if (
          req.body.businessTask === undefined ||
          req.body.businessTask === null
        ) {
          const wallet = parseInt(user.subscriptionWallet || 0, 10);
          const deducted = parseInt(user.subscriptiondeductedWallet || 0, 10);

          req.body.businessTask = wallet + deducted;
        }

        // Write to registration instead of connectDate
        req.body.registration = user.createdAt ? "completed" : "not completed";
      }
    }

    // ---------------------------
    // CATEGORY LOGIC (overwrite always)
    // ---------------------------
    const bt = parseInt(req.body.businessTask);

    if (!bt || bt === 0) req.body.category = "not working";
    else if (bt >= 1 && bt <= 5) req.body.category = "Starter";
    else if (bt >= 6 && bt <= 10) req.body.category = "Basic";
    else if (bt >= 11 && bt <= 15) req.body.category = "Bronze";
    else if (bt >= 16 && bt <= 20) req.body.category = "Silver";
    else if (bt >= 21 && bt <= 25) req.body.category = "Gold";
    else if (bt >= 26 && bt <= 35) req.body.category = "Diamond";
    else if (bt >= 36 && bt <= 70) req.body.category = "Platinum";
    // ---------------------------

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

    // allow date objects even if they look falsy
    if (incoming === undefined || incoming === null) continue;

    // Handle JSON day fields
    if (
      ["day1", "day2", "day3", "day4", "day5", "day6", "day7"].includes(key)
    ) {
      if (typeof incoming === "object" && !Array.isArray(incoming)) {
        // Skip empty {}
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
      // 1️⃣ Fetch manager name
      const manager = await model.TeamManager.findOne({
        where: { id: managerId },
        attributes: ["name"], // assuming TeamManager has 'name' column
      });

      if (manager && manager.name) {
        whereCondition.alloted = manager.name;
      } else {
        // If managerId is invalid, no student should match
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
            include: ["businessTask", "registration", "activeStatus"], // fetch registration too
          },
          order: [["id", "DESC"]],
        },
      ],
      order: [["id", "DESC"]],
    });

    // Move registration out of BdSheet to top-level
    const formattedData = data.map((student) => {
      const studentJSON = student.toJSON();

      if (studentJSON.BdSheet && studentJSON.BdSheet.registration) {
        studentJSON.registration = studentJSON.BdSheet.registration;
      }

      // Remove registration from BdSheet
      if (studentJSON.BdSheet) {
        delete studentJSON.BdSheet.registration;
      }

      return studentJSON;
    });

    // ---------------------------
    // Fetch all managers (as you requested)
    // ---------------------------
    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email"],
      raw: true,
    });

    return ReS(res, { 
      count: formattedData.length, 
      data: formattedData,
      managers: managers   // <-- added here
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
        });
      } else {
        // no manager filter — count across all BdSheets
        categoryCounts[cat] = await model.BdSheet.count({
          where: { category: cat },
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
      categoryCounts, // <-- only addition
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

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        targetDate: {
          [Op.between]: [startDate, endDate],
        },
      };
    }

    const managerFilter = managerId ? { teamManagerId: parseInt(managerId) } : {};

    const bdTargetData = await model.BdTarget.findAll({
      where: {
        ...managerFilter,
        ...dateFilter,
      },
      attributes: ["internsAllocated", "internsActive", "accounts"],
    });

    let totalInternsAllocated = 0;
    let totalInternsActive = 0;
    let totalAccounts = 0;

    bdTargetData.forEach((row) => {
      totalInternsAllocated += row.internsAllocated;
      totalInternsActive += row.internsActive;
      totalAccounts += row.accounts;
    });

    return ReS(res, {
      bdTarget: {
        totalInternsAllocated,
        totalInternsActive,
        totalAccounts,
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




