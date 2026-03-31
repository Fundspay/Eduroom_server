"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");
const axios = require("axios");

const upsertMSheet = async (req, res) => {
  try {
    const {
      aSheetId, rmAssignedName, rmAssignedContact, domainName,
      websiteStartDate, websiteCompletionDate, trainingAndHandoverStatus,
      servicesOpted, clientFeedback, renewalDate, renewalStatus,
    } = req.body;

    if (!aSheetId) return ReE(res, "aSheetId is required.", 400);

    let existing = await model.MSheet.findOne({ where: { aSheetId } });

    const updatedData = {};
    if (rmAssignedName !== undefined) updatedData.rmAssignedName = rmAssignedName;
    if (rmAssignedContact !== undefined) updatedData.rmAssignedContact = rmAssignedContact;
    if (domainName !== undefined) updatedData.domainName = domainName;
    if (websiteStartDate !== undefined) updatedData.websiteStartDate = websiteStartDate || null;
    if (websiteCompletionDate !== undefined) updatedData.websiteCompletionDate = websiteCompletionDate || null;
    if (trainingAndHandoverStatus !== undefined) updatedData.trainingAndHandoverStatus = trainingAndHandoverStatus;
    if (servicesOpted !== undefined) updatedData.servicesOpted = servicesOpted;
    if (clientFeedback !== undefined) updatedData.clientFeedback = clientFeedback;
    if (renewalDate !== undefined) updatedData.renewalDate = renewalDate || null;
    if (renewalStatus !== undefined) updatedData.renewalStatus = renewalStatus;

    let result, message;

    if (existing) {
      await existing.update(updatedData);
      result = existing;
      message = "MSheet record updated successfully.";
    } else {
      result = await model.MSheet.create({ aSheetId, ...updatedData });
      message = "MSheet record created successfully.";
    }

    return ReS(res, { success: true, message, data: result }, 200);
  } catch (error) {
    console.error("upsertMSheet Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.upsertMSheet = upsertMSheet;


const updateMSheet = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      rmAssignedName, rmAssignedContact, domainName, websiteStartDate,
      websiteCompletionDate, trainingAndHandoverStatus, servicesOpted,
      clientFeedback, renewalDate, renewalStatus, aSheetId,
    } = req.body;

    if (!id) return ReE(res, "MSheet id is required in URL.", 400);

    const existing = await model.MSheet.findByPk(id);
    if (!existing) return ReE(res, "MSheet record not found.", 404);

    const updatedData = {};
    if (rmAssignedName !== undefined) updatedData.rmAssignedName = rmAssignedName;
    if (rmAssignedContact !== undefined) updatedData.rmAssignedContact = rmAssignedContact;
    if (domainName !== undefined) updatedData.domainName = domainName;
    if (websiteStartDate !== undefined) updatedData.websiteStartDate = websiteStartDate || null;
    if (websiteCompletionDate !== undefined) updatedData.websiteCompletionDate = websiteCompletionDate || null;
    if (trainingAndHandoverStatus !== undefined) updatedData.trainingAndHandoverStatus = trainingAndHandoverStatus;
    if (servicesOpted !== undefined) updatedData.servicesOpted = servicesOpted;
    if (clientFeedback !== undefined) updatedData.clientFeedback = clientFeedback;
    if (renewalDate !== undefined) updatedData.renewalDate = renewalDate || null;
    if (renewalStatus !== undefined) updatedData.renewalStatus = renewalStatus;
    if (aSheetId !== undefined) updatedData.aSheetId = aSheetId;

    await existing.update(updatedData);
    return ReS(res, { success: true, message: "MSheet record updated successfully.", data: existing }, 200);
  } catch (error) {
    console.error("updateMSheet Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.updateMSheet = updateMSheet;


var fetchMSheetById = async (req, res) => {
  try {
    const msheet = await model.MSheet.findByPk(req.params.id, {
      include: [{ model: model.ASheet }],
    });

    if (!msheet || !msheet.isActive) return ReE(res, "MSheet not found", 404);
    return ReS(res, { success: true, msheet: msheet.get({ plain: true }) }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchMSheetById = fetchMSheetById;


var fetchMSheetsByTeamManagerId = async (req, res) => {
  try {
    const msheets = await model.MSheet.findAll({
      include: [{
        model: model.ASheet,
        where: { teamManagerId: req.params.teamManagerId },
        required: true,
      }],
    });

    return ReS(res, { success: true, msheets }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchMSheetsByTeamManagerId = fetchMSheetsByTeamManagerId;


var fetchAllMSheets = async (req, res) => {
  try {
    const msheets = await model.MSheet.findAll({
      include: [{ model: model.ASheet }],
    });

    return ReS(res, { success: true, msheets }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchAllMSheets = fetchAllMSheets;


const mgetMSheetsByTeamManagerId = async (req, res) => {
  try {
    const { teamManagerId } = req.params;
    if (!teamManagerId) return ReE(res, "teamManagerId is required.", 400);

    const manager = await model.TeamManager.findByPk(teamManagerId, {
      attributes: ["name"],
    });

    if (!manager) return ReE(res, "TeamManager not found.", 404);

    const fullName = manager.name?.trim();
    if (!fullName) return ReE(res, "TeamManager has no valid name to match.", 400);

    const msheets = await model.MSheet.findAll({
      where: { rmAssignedName: { [Op.iLike]: `%${fullName}%` } },
      include: [{ model: model.ASheet, required: false }],
    });

    return ReS(res, {
      success: true,
      total: msheets.length,
      rmName: fullName,
      data: msheets,
    }, 200);
  } catch (error) {
    console.error("mgetMSheetsByTeamManagerId Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.mgetMSheetsByTeamManagerId = mgetMSheetsByTeamManagerId;


const fetchSubscriptionC1AndMSheetDetailsByRM = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name || !name.trim()) return ReE(res, "RM name is required.", 400);

    const msheets = await model.MSheet.findAll({
      where: { rmAssignedName: { [Op.iLike]: `%${name.trim()}%` } },
      include: [{ model: model.ASheet, required: true }],
      order: [[model.ASheet, "dateOfConnect", "DESC"]], // ✅ no alias
    });

    const combinedResults = await Promise.all(
      msheets.map(async (m) => {
        const row = m.toJSON();
        const asheet = row.ASheet || {};  // Sequelize uses model name as key when no alias

        const email = asheet.email?.trim() || "";
        const phoneNumber = asheet.mobileNumber?.trim() || "";

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
          fundsWebData = { message: "Missing client email or phone number" };
        }

        return { ...asheet, MSheet: { ...row }, fundsWebData };
      })
    );

    const cleanedArray = combinedResults.filter(
      (item) =>
        !item.c4Status ||
        (item.c4Status &&
          item.c4Status.trim() !== "" &&
          item.c4Status.trim().toLowerCase() !== "null")
    );

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

    return ReS(res, {
      success: true,
      total: cleanedArray.length,
      data: cleanedArray,
      managers,
    }, 200);
  } catch (error) {
    console.error("fetchSubscriptionC1AndMSheetDetailsByRM Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchSubscriptionC1AndMSheetDetailsByRM = fetchSubscriptionC1AndMSheetDetailsByRM;