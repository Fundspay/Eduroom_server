"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, Sequelize } = require("sequelize");
const axios = require("axios");

const fetchC1ScheduledDetails = async (req, res) => {
  try {
    const c1ScheduledRows = await model.ASheet.findAll({
      where: { meetingStatus: { [Op.iLike]: "%C1 Scheduled%" } },
      order: [["dateOfConnect", "DESC"]],
      raw: true,
    });

    return ReS(res, {
      success: true,
      totalC1Scheduled: c1ScheduledRows.length,
      data: c1ScheduledRows,
    }, 200);
  } catch (error) {
    console.error("fetchC1ScheduledDetails Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchC1ScheduledDetails = fetchC1ScheduledDetails;


const updateASheetFollowupFields = async (req, res) => {
  try {
    const record = await model.ASheet.findByPk(req.params.id);
    if (!record) return ReE(res, "ASheet record not found", 404);

    const allowedFields = [
      "dateOfC1Connect", "c1Status", "c1Comment",
      "dateOfC2Clarity", "c2Status", "c2Comment",
      "dateOfC3Clarity", "c3Status", "c3Comment",
      "dateOfC4Customer", "c4Status", "c4Comment",
    ];

    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (!Object.keys(updates).length) return ReE(res, "No valid follow-up fields provided for update", 400);

    await record.update(updates);
    return ReS(res, { success: true, message: "Follow-up fields updated successfully", data: record }, 200);
  } catch (error) {
    console.error("updateASheetFollowupFields Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.updateASheetFollowupFields = updateASheetFollowupFields;


const getC1ScheduledByTeamManager = async (req, res) => {
  try {
    const teamManagerId = req.query.teamManagerId || req.params.teamManagerId;
    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

    const manager = await model.TeamManager.findOne({
      where: { id: teamManagerId },
      attributes: ["id", "name", "email", "mobileNumber"],
      raw: true,
    });

    if (!manager) return ReE(res, "TeamManager not found", 404);

    const aSheetData = await model.ASheet.findAll({
      where: {
        sourcedBy: { [Op.iLike]: manager.name },
        meetingStatus: { [Op.iLike]: "%C1 Scheduled%" },
      },
      order: [["dateOfConnect", "DESC"]],
      raw: true,
      attributes: [
        "id", "sr", "sourcedFrom", "sourcedBy", "dateOfConnect", "businessName",
        "contactPersonName", "mobileNumber", "address", "email", "businessSector",
        "zone", "landmark", "existingWebsite", "smmPresence", "meetingStatus", "teamManagerId",
        "dateOfC1Connect", "c1Status", "c1Comment",
        "dateOfC2Clarity", "c2Status", "c2Comment",
        "dateOfC3Clarity", "c3Status", "c3Comment",
        "dateOfC4Customer", "c4Status", "c4Comment",
        "createdAt", "updatedAt",
      ],
    });

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
    console.error("getC1ScheduledByTeamManager Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getC1ScheduledByTeamManager = getC1ScheduledByTeamManager;


const c1Attributes = [
  "id", "sr", "sourcedFrom", "sourcedBy", "dateOfConnect", "businessName",
  "contactPersonName", "mobileNumber", "address", "email", "businessSector",
  "zone", "landmark", "existingWebsite", "smmPresence", "meetingStatus", "teamManagerId",
  "dateOfC1Connect", "c1Status", "c1Comment",
  "dateOfC2Clarity", "c2Status", "c2Comment",
  "dateOfC3Clarity", "c3Status", "c3Comment",
  "dateOfC4Customer", "c4Status", "c4Comment",
  "createdAt", "updatedAt",
];

const getAllFollowUps = async (req, res) => {
  try {
    const aSheetData = await model.ASheet.findAll({
      where: {
        [Op.or]: [
          { c1Status: { [Op.iLike]: "%Follow Up%" } },
          { c2Status: { [Op.iLike]: "%Follow Up%" } },
          { c3Status: { [Op.iLike]: "%Follow Up%" } },
          { c4Status: { [Op.iLike]: "%Follow Up%" } },
        ],
      },
      order: [["dateOfConnect", "ASC"]],
      raw: true,
      attributes: c1Attributes,
    });

    return ReS(res, { success: true, totalRecords: aSheetData.length, data: aSheetData });
  } catch (error) {
    console.error("getAllFollowUps Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getAllFollowUps = getAllFollowUps;


const getAllNotintrested = async (req, res) => {
  try {
    const aSheetData = await model.ASheet.findAll({
      where: {
        [Op.or]: [
          { c1Status: { [Op.iLike]: "%Not Intrested%" } },
          { c2Status: { [Op.iLike]: "%Not Intrested%" } },
          { c3Status: { [Op.iLike]: "%Not Intrested%" } },
          { c4Status: { [Op.iLike]: "%Not Intrested%" } },
        ],
      },
      order: [["dateOfConnect", "ASC"]],
      raw: true,
      attributes: c1Attributes,
    });

    return ReS(res, { success: true, totalRecords: aSheetData.length, data: aSheetData });
  } catch (error) {
    console.error("getAllNotintrested Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getAllNotintrested = getAllNotintrested;


const getAllDicey = async (req, res) => {
  try {
    const aSheetData = await model.ASheet.findAll({
      where: {
        [Op.or]: [
          { c1Status: { [Op.iLike]: "%Dicey%" } },
          { c2Status: { [Op.iLike]: "%Dicey%" } },
          { c3Status: { [Op.iLike]: "%Dicey%" } },
          { c4Status: { [Op.iLike]: "%Dicey%" } },
        ],
      },
      order: [["dateOfConnect", "ASC"]],
      raw: true,
      attributes: c1Attributes,
    });

    return ReS(res, { success: true, totalRecords: aSheetData.length, data: aSheetData });
  } catch (error) {
    console.error("getAllDicey Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getAllDicey = getAllDicey;


const fetchSubscriptionC1AndMSheetDetails = async (req, res) => {
  try {
    const rows = await model.ASheet.findAll({
      where: {
        c4Status: {
          [Op.and]: [
            { [Op.ne]: null },
            { [Op.ne]: "" },
            { [Op.notILike]: "%null%" },
          ],
        },
      },
      include: [{ model: model.MSheet, required: false, as: "MSheet" }],
    });

    const combinedResults = await Promise.all(
      rows.map(async (row) => {
        const email = row.email?.trim() || "";
        const phoneNumber = row.mobileNumber?.trim() || "";
        let fundsWebData = null;

        if (email || phoneNumber) {
          const apiUrl = `https://api.fundsweb.in/api/v1/userdomain/fetch/${email || "null"}/${phoneNumber || "null"}`;
          try {
            const response = await axios.get(apiUrl, { timeout: 5000 });
            fundsWebData = response.data;
          } catch {
            fundsWebData = { message: "Failed to fetch external API data" };
          }
        } else {
          fundsWebData = { message: "Missing email and phone number" };
        }

        return { ...row.toJSON(), fundsWebData };
      })
    );

    // Fetch all active TeamManagers
    const allManagers = await model.TeamManager.findAll({
      where: { isDeleted: false },
      attributes: ["id", "name", "email", "mobileNumber", "managerId"],
    });

    const managers = allManagers.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      mobileNumber: m.mobileNumber,
      managerId: m.managerId,
    }));

    const c1ScheduledRows = await model.ASheet.findAll({
      where: { meetingStatus: { [Op.iLike]: "%C1 Scheduled%" } },
      include: [{ model: model.MSheet, required: false, as: "MSheet" }],
      order: [["dateOfConnect", "DESC"]],
    });

    const existingIds = new Set(combinedResults.map((r) => r.id));
    const c1Filtered = c1ScheduledRows
      .filter((r) => !existingIds.has(r.id))
      .map((r) => r.toJSON());

    const finalArray = [...combinedResults, ...c1Filtered];

    const cleanedArray = finalArray
      .filter(
        (item) =>
          item.c4Status &&
          item.c4Status.trim() !== "" &&
          item.c4Status.trim().toLowerCase() !== "null"
      )
      .sort((a, b) => new Date(b.dateOfConnect) - new Date(a.dateOfConnect));

    return ReS(res, {
      success: true,
      total: cleanedArray.length,
      data: cleanedArray,
      managers,
    }, 200);
  } catch (error) {
    console.error("fetchSubscriptionC1AndMSheetDetails Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchSubscriptionC1AndMSheetDetails = fetchSubscriptionC1AndMSheetDetails;