"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

const upsertBdSheet = async (req, res) => {
  try {
    const { studentResumeId } = req.body;
    if (!studentResumeId) return ReE(res, "studentResumeId is required", 400);

    // ------- AUTO-FILL businessTask -------
const resume = await model.StudentResume.findOne({
  where: { id: studentResumeId }
});

if (resume) {
  // Fetch user by mobileNumber
  const user = await model.User.findOne({
    where: { phoneNumber: resume.mobileNumber }
  });

  if (user && (req.body.businessTask === undefined || req.body.businessTask === null)) {
    // Convert to integer to match getUserWalletDetails logic
    req.body.businessTask = parseInt(user.subscriptionWallet || 0, 10);
  }
}


    // ------- UPSERT -------
    let sheet = await model.BdSheet.findOne({
      where: { studentResumeId }
    });

    if (sheet) {
      // 🚀 Filter only fields which user actually sent
      const updateFields = filterUpdateFields(req.body, sheet);

      await sheet.update(updateFields);
      return ReS(res, { message: "BdSheet updated successfully", data: sheet });
    }

    // CREATE
    const newSheet = await model.BdSheet.create(req.body);
    return ReS(res, { message: "BdSheet created successfully", data: newSheet });

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

    // Skip undefined/null
    if (incoming == null) continue;

    // Handle JSON day fields
    if (["day1","day2","day3","day4","day5","day6","day7"].includes(key)) {
      if (typeof incoming === "object" && !Array.isArray(incoming)) {
        // Skip empty {}
        if (Object.keys(incoming).length === 0) continue;
      }

      allowed[key] = {
        ...existingSheet[key],
        ...incoming
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
        attributes: ["name"] // assuming TeamManager has 'name' column
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
        "domain"
      ],
      include: [
        {
          model: model.BdSheet,
          required: false,
          attributes: {
            include: ["businessTask"]
          },
          order: [["id", "DESC"]]
        }
      ],
      order: [["id", "DESC"]]
    });

    return ReS(res, { count: data.length, data });
  } catch (err) {
    console.log("GET BD SHEET ERROR:", err);
    return ReE(res, err.message, 500);
  }
};

module.exports.getBdSheet = getBdSheet;



