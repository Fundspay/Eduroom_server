"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

const upsertBdSheet = async (req, res) => {
  try {
    const { studentResumeId } = req.body;
    if (!studentResumeId) return ReE(res, "studentResumeId is required", 400);

    // 1️⃣ Fetch StudentResume to get mobile number
    const resume = await model.StudentResume.findOne({
      where: { id: studentResumeId }
    });

    if (resume) {
      // 2️⃣ Fetch User by mobileNumber (correct matching)
      const user = await model.User.findOne({
        where: { phoneNumber: resume.mobileNumber }
      });

      // 3️⃣ Put subscriptionWallet → businessTask
      if (user) {
        req.body.businessTask = user.subscriptionWallet || 0;
      }
    }

    // -------------------------
    // EXISTING UPSERT LOGIC
    // -------------------------

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


