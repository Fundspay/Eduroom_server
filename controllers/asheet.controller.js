"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, Sequelize } = require("sequelize");
const XLSX = require("xlsx");

// Create / Upload ASheet (JSON data)
const createASheet = async (req, res) => {
  try {
    const dataArray = Array.isArray(req.body) ? req.body : [req.body];
    if (!dataArray.length) return ReE(res, "No data provided", 400);

    const insertedRecords = [];

    for (const data of dataArray) {
      const teamManagerId = data.teamManagerId ?? req.teamManager?.id;
      if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

      // Check if TeamManager exists
      const managerExists = await model.TeamManager.findByPk(teamManagerId);
      if (!managerExists) return ReE(res, `TeamManager with id ${teamManagerId} does not exist`, 400);

      const payload = {
        sr: data.sr ?? null,
        sourcedFrom: data.sourcedFrom ?? null,
        sourcedBy: data.sourcedBy ?? null,
        dateOfConnect: data.dateOfConnect ?? null,
        businessName: data.businessName ?? null,
        contactPersonName: data.contactPersonName ?? null,
        mobileNumber: data.mobileNumber ? String(data.mobileNumber) : null,
        address: data.address ?? null,
        email: data.email ?? null,
        businessSector: data.businessSector ?? null,
        zone: data.zone ?? null,
        landmark: data.landmark ?? null,
        existingWebsite: data.existingWebsite ?? null,
        smmPresence: data.smmPresence ?? null,
        meetingStatus: data.meetingStatus ?? null,
        teamManagerId: teamManagerId,
      };

      // Duplicate check: mobileNumber or email
      const whereClause = {};
      if (payload.mobileNumber) whereClause.mobileNumber = payload.mobileNumber;
      if (payload.email) whereClause.email = payload.email;

      let existing = null;
      if (Object.keys(whereClause).length) {
        existing = await model.ASheet.findOne({ where: whereClause });
      }

      if (existing) continue; // Skip duplicates

      const record = await model.ASheet.create(payload);
      insertedRecords.push(record);
    }

    return ReS(res, { success: true, total: insertedRecords.length, data: insertedRecords }, 201);
  } catch (error) {
    console.error("ASheet Create Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.createASheet = createASheet;


const updateASheetFields = async (req, res) => {
  try {
    const record = await model.ASheet.findByPk(req.params.id);
    if (!record) return ReE(res, "ASheet record not found", 404);

    const { teamManagerId, ...updateData } = req.body;

    // 🔹 Validate teamManagerId if provided
    if (teamManagerId !== undefined) {
      const managerExists = await model.TeamManager.findByPk(teamManagerId);
      if (!managerExists) return ReE(res, `TeamManager with id ${teamManagerId} does not exist`, 400);
      updateData.teamManagerId = teamManagerId;
    }

    const allowedFields = [
      "sr",
      "sourcedFrom",
      "sourcedBy",
      "dateOfConnect",
      "businessName",
      "contactPersonName",
      "mobileNumber",
      "address",
      "email",
      "businessSector",
      "zone",
      "landmark",
      "existingWebsite",
      "smmPresence",
      "meetingStatus",
      "teamManagerId",
    ];

    const updates = {};
    for (const key of allowedFields) {
      if (updateData[key] !== undefined) {
        updates[key] = key === "mobileNumber" ? String(updateData[key]) : updateData[key];
      }
    }

    if (!Object.keys(updates).length) return ReE(res, "No valid fields to update", 400);

    await record.update(updates);
    return ReS(res, { success: true, data: record }, 200);
  } catch (error) {
    console.error("ASheet Update Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.updateASheetFields = updateASheetFields;


// Get all ASheets
const getASheets = async (req, res) => {
  try {
    const records = await model.ASheet.findAll({
      raw: true,
      order: [["createdAt", "DESC"]],
      attributes: [
        "id", "sr", "sourcedFrom", "sourcedBy", "dateOfConnect",
        "businessName", "contactPersonName", "mobileNumber", "address",
        "email", "businessSector", "zone", "landmark", "existingWebsite",
        "smmPresence", "meetingStatus", "teamManagerId", "createdAt", "updatedAt",
      ],
    });

    // Fetch active TeamManagers
    const managers = await model.TeamManager.findAll({
      where: { isDeleted: false },
      attributes: ["id", "name", "email", "managerId"],
      raw: true,
    });

    return ReS(res, {
      success: true,
      total: records.length,
      data: records,
      managers,
    }, 200);
  } catch (error) {
    console.error("ASheet Fetch All Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getASheets = getASheets;


// Get single ASheet
const getASheetById = async (req, res) => {
  try {
    const record = await model.ASheet.findByPk(req.params.id);
    if (!record) return ReE(res, "ASheet record not found", 404);
    return ReS(res, { success: true, data: record }, 200);
  } catch (error) {
    console.error("ASheet Fetch Single Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getASheetById = getASheetById;


const deleteASheet = async (req, res) => {
  try {
    const record = await model.ASheet.findByPk(req.params.id);
    if (!record) return ReE(res, "ASheet record not found", 404);

    await record.destroy();
    return ReS(res, { success: true, message: "ASheet record deleted successfully" }, 200);
  } catch (error) {
    console.error("ASheet Delete Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.deleteASheet = deleteASheet;


const getindividualManagerId = async (req, res) => {
  try {
    const teamManagerId = req.query.teamManagerId || req.params.teamManagerId;
    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

    const manager = await model.TeamManager.findOne({
      where: { id: teamManagerId },
      attributes: ["id", "name", "email", "mobileNumber", "managerId"],
      raw: true,
    });

    if (!manager) return ReE(res, "TeamManager not found", 404);

    // Fetch ASheet records for that manager (latest first)
    const aSheetData = await model.ASheet.findAll({
      where: {
        sourcedBy: { [Op.iLike]: manager.name },
      },
      order: [["dateOfConnect", "DESC"]],
      raw: true,
      attributes: [
        "id", "sr", "sourcedFrom", "sourcedBy", "dateOfConnect",
        "businessName", "contactPersonName", "mobileNumber", "address",
        "email", "businessSector", "zone", "landmark", "existingWebsite",
        "smmPresence", "meetingStatus", "teamManagerId", "createdAt", "updatedAt",
      ],
    });

    // Fetch all active TeamManagers
    const allManagers = await model.TeamManager.findAll({
      where: { isDeleted: false },
      attributes: ["id", "name", "email", "managerId"],
      raw: true,
    });

    return ReS(res, {
      success: true,
      teamManagerId: manager.id,
      managerName: manager.name,
      totalRecords: aSheetData.length,
      data: aSheetData,
      managers: allManagers,
    });
  } catch (error) {
    console.error("Get ASheet By TeamManagerId Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getindividualManagerId = getindividualManagerId;


const fetchFollowUpTarget = async (req, res) => {
  try {
    const followUpRows = await model.ASheet.findAll({
      where: { meetingStatus: { [Op.iLike]: "%Follow Up%" } },
      order: [["dateOfConnect", "ASC"]],
      raw: true,
    });

    const allManagers = await model.TeamManager.findAll({
      where: { isDeleted: false },
      attributes: ["id", "name", "email", "managerId"],
      raw: true,
    });

    return ReS(res, {
      success: true,
      data: followUpRows,
      totalFollowUp: followUpRows.length,
      managers: allManagers,
    }, 200);
  } catch (error) {
    console.error("fetchFollowUpTarget Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchFollowUpTarget = fetchFollowUpTarget;


const fetchCNA = async (req, res) => {
  try {
    const rows = await model.ASheet.findAll({
      where: { meetingStatus: { [Op.iLike]: "%CNA%" } },
      order: [["dateOfConnect", "ASC"]],
      raw: true,
    });

    const allManagers = await model.TeamManager.findAll({
      where: { isDeleted: false },
      attributes: ["id", "name", "email", "managerId"],
      raw: true,
    });

    return ReS(res, { success: true, data: rows, totalCNA: rows.length, managers: allManagers }, 200);
  } catch (error) {
    console.error("fetchCNA Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchCNA = fetchCNA;


const fetchNotInterested = async (req, res) => {
  try {
    const rows = await model.ASheet.findAll({
      where: { meetingStatus: { [Op.iLike]: "%Not Interested%" } },
      order: [["dateOfConnect", "ASC"]],
      raw: true,
    });

    const allManagers = await model.TeamManager.findAll({
      where: { isDeleted: false },
      attributes: ["id", "name", "email", "managerId"],
      raw: true,
    });

    return ReS(res, { success: true, data: rows, totalNotInterested: rows.length, managers: allManagers }, 200);
  } catch (error) {
    console.error("fetchNotInterested Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchNotInterested = fetchNotInterested;


const fetchSwitchOff = async (req, res) => {
  try {
    const rows = await model.ASheet.findAll({
      where: { meetingStatus: { [Op.iLike]: "%Switch Off%" } },
      order: [["dateOfConnect", "ASC"]],
      raw: true,
    });

    const allManagers = await model.TeamManager.findAll({
      where: { isDeleted: false },
      attributes: ["id", "name", "email", "managerId"],
      raw: true,
    });

    return ReS(res, { success: true, data: rows, totalSwitchOff: rows.length, managers: allManagers }, 200);
  } catch (error) {
    console.error("fetchSwitchOff Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchSwitchOff = fetchSwitchOff;


const fetchWrongNumber = async (req, res) => {
  try {
    const rows = await model.ASheet.findAll({
      where: { meetingStatus: { [Op.iLike]: "%Wrong Number%" } },
      order: [["dateOfConnect", "ASC"]],
      raw: true,
    });

    const allManagers = await model.TeamManager.findAll({
      where: { isDeleted: false },
      attributes: ["id", "name", "email", "managerId"],
      raw: true,
    });

    return ReS(res, { success: true, data: rows, totalWrongNumber: rows.length, managers: allManagers }, 200);
  } catch (error) {
    console.error("fetchWrongNumber Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchWrongNumber = fetchWrongNumber;