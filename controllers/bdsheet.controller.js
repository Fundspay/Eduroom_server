"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

const upsertBdSheet = async (req, res) => {
  try {
    const { studentResumeId } = req.body;
    if (!studentResumeId) return ReE(res, "studentResumeId is required", 400);

    // Check if record exists
    let sheet = await model.BdSheet.findOne({
      where: { studentResumeId }
    });

    if (sheet) {
      // UPDATE
      await sheet.update(req.body);
      return ReS(res, { message: "BdSheet updated successfully", data: sheet });
    } else {
      // CREATE
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
      whereCondition.studentResumeId = resumeId;
    }

    const data = await model.BdSheet.findAll({
      where: whereCondition,
      include: [
        {
          model: model.StudentResume,
          attributes: [
            "id",
            "studentName",
            "mobileNumber",
            "emailId",
            "domain"
          ]
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
model.exports.getBdSheet = getBdSheet;