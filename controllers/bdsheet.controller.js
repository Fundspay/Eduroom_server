"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

const upsertBdSheet = async (req, res) => {
  try {
    const { studentResumeId } = req.body;
    if (!studentResumeId) return ReE(res, "studentResumeId is required", 400);

    // AUTO-FILL businessTask
    const resume = await model.StudentResume.findOne({
      where: { id: studentResumeId }
    });

    if (resume) {
      const user = await model.User.findOne({
        where: { phoneNumber: resume.mobileNumber }
      });

      if (user && user.subscriptionWallet != null) {
        if (req.body.businessTask === undefined || req.body.businessTask === null) {
          req.body.businessTask = user.subscriptionWallet;
        }
      }
    }

    // 1️⃣ CLEAN req.body INCLUDING nested JSON
    cleanObject(req.body);

    // UPSERT
    let sheet = await model.BdSheet.findOne({
      where: { studentResumeId }
    });

    if (sheet) {
      await sheet.update(req.body);
      return ReS(res, { message: "BdSheet updated successfully", data: sheet });
    } else {
      const newSheet = await model.BdSheet.create(req.body);
      return ReS(res, { message: "BdSheet created successfully", data: newSheet });
    }

  } catch (error) {
    console.log("BD SHEET UPSERT ERROR:", error);
    return ReE(res, error.message, 500);
  }
};

// Helper for nested cleaning
function cleanObject(obj) {
  Object.keys(obj).forEach(key => {
    const value = obj[key];

    if (value === undefined || value === null) {
      delete obj[key];
    } else if (typeof value === "object" && !Array.isArray(value)) {
      cleanObject(value);
      if (Object.keys(value).length === 0) delete obj[key];
    }
  });

  return obj;
}

module.exports.upsertBdSheet = upsertBdSheet;


const getBdSheet = async (req, res) => {
  try {
    const { resumeId } = req.query;

    let whereCondition = {};
    if (resumeId) {
      whereCondition.id = resumeId;  // Match StudentResume.id
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
          required: false,   // LEFT JOIN
          attributes: {
            include: ["businessTask"]   // ⭐ ADDED THIS
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


