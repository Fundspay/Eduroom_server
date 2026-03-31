"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

const upsertMSheet = async (req, res) => {
  try {
    const {
      aSheetId,
      rmAssignedName,
      rmAssignedContact,
      domainName,
      websiteStartDate,
      websiteCompletionDate,
      trainingAndHandoverStatus,
      servicesOpted,
      clientFeedback,
      renewalDate,
      renewalStatus,
    } = req.body;

    if (!aSheetId) {
      return ReE(res, "aSheetId is required.", 400);
    }

    // Find existing record by aSheetId
    let existing = await model.MSheet.findOne({ where: { aSheetId } });

    // Prepare only fields present in request body
    const updatedData = {};
    if (rmAssignedName !== undefined) updatedData.rmAssignedName = rmAssignedName;
    if (rmAssignedContact !== undefined) updatedData.rmAssignedContact = rmAssignedContact;
    if (domainName !== undefined) updatedData.domainName = domainName;
    if (websiteStartDate !== undefined) updatedData.websiteStartDate = websiteStartDate || null; // handle empty string
    if (websiteCompletionDate !== undefined) updatedData.websiteCompletionDate = websiteCompletionDate || null;
    if (trainingAndHandoverStatus !== undefined) updatedData.trainingAndHandoverStatus = trainingAndHandoverStatus;
    if (servicesOpted !== undefined) updatedData.servicesOpted = servicesOpted;
    if (clientFeedback !== undefined) updatedData.clientFeedback = clientFeedback;
    if (renewalDate !== undefined) updatedData.renewalDate = renewalDate || null;
    if (renewalStatus !== undefined) updatedData.renewalStatus = renewalStatus;

    let result, message;

    if (existing) {
      // Update only provided fields
      await existing.update(updatedData);
      result = existing;
      message = "MSheet record updated successfully.";
    } else {
      // Create new record with provided fields
      result = await model.MSheet.create({
        aSheetId,
        ...updatedData,
      });
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
    const { id } = req.params; // MSheet ID from URL
    const {
      rmAssignedName,
      rmAssignedContact,
      domainName,
      websiteStartDate,
      websiteCompletionDate,
      trainingAndHandoverStatus,
      servicesOpted,
      clientFeedback,
      renewalDate,
      renewalStatus,
            aSheetId,
    } = req.body;

    if (!id) {
      return ReE(res, "MSheet id is required in URL.", 400);
    }

    // Find existing MSheet by id
    const existing = await model.MSheet.findByPk(id);

    if (!existing) {
      return ReE(res, "MSheet record not found.", 404);
    }

    // Prepare only fields present in request body
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

    // Update record
    await existing.update(updatedData);

    return ReS(res, { success: true, message: "MSheet record updated successfully.", data: existing }, 200);

  } catch (error) {
    console.error("updateMSheet Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.updateMSheet = updateMSheet;


// ✅ Fetch Single MSheet by ID
var fetchMSheetById = async (req, res) => {
    try {
        const msheet = await model.MSheet.findByPk(req.params.id, {
            include: [
                { model: model.ASheet } // include parent sheet info
            ]
        });

        if (!msheet || !msheet.isActive) return ReE(res, "MSheet not found", 404);

        return ReS(res, { success: true, msheet: msheet.get({ plain: true }) }, 200);

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchMSheetById = fetchMSheetById;

// ✅ Fetch MSheets by User ID (assuming ASheet has userId)
var fetchMSheetsByUserId = async (req, res) => {
    try {
        const msheets = await model.MSheet.findAll({
            include: [
                {
                    model: model.ASheet,
                    where: { userId: req.params.userId },
                    required: true
                }
            ]
        });

        return ReS(res, { success: true, msheets }, 200);

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchMSheetsByUserId = fetchMSheetsByUserId;

// ✅ Fetch All MSheets
var fetchAllMSheets = async (req, res) => {
    try {
        const msheets = await model.MSheet.findAll({
            include: [
                { model: model.ASheet }
            ]
        });

        return ReS(res, { success: true, msheets }, 200);

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAllMSheets = fetchAllMSheets;


const mgetMSheetsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return ReE(res, "userId is required.", 400);
    }

    // Step 1: Find user by ID
    const user = await model.User.findByPk(userId, {
      attributes: ["firstName", "lastName"],
    });

    if (!user) {
      return ReE(res, "User not found.", 404);
    }

    // Step 2: Build the RM name (trim to avoid mismatches)
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();

    if (!fullName) {
      return ReE(res, "User has no valid name to match.", 400);
    }

    // Step 3: Find all MSheet rows where rmAssignedName matches the user's full name
    const msheets = await model.MSheet.findAll({
      where: {
        rmAssignedName: {
          [Op.iLike]: `%${fullName}%`, // allows partial match (case-insensitive)
        },
      },
      include: [
        {
          model: model.ASheet,
          required: false,
        },
      ],
    });

    // Step 4: Return response
    return ReS(res, {
      success: true,
      total: msheets.length,
      rmName: fullName,
      data: msheets,
    }, 200);

  } catch (error) {
    console.error("getMSheetsByUserId Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.mgetMSheetsByUserId = mgetMSheetsByUserId;

const fetchSubscriptionC1AndMSheetDetailsByRM = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || !name.trim()) {
      return ReE(res, "RM name is required.", 400);
    }

    // Step 1: Find all MSheet records where RM name matches
    const msheets = await model.MSheet.findAll({
      where: {
        rmAssignedName: { [Op.iLike]: `%${name.trim()}%` },
      },
      include: [
        {
          model: model.ASheet,
          as: "ASheet",
          required: true,
        },
      ],
      order: [[{ model: model.ASheet, as: "ASheet" }, "dateOfConnect", "DESC"]], // ✅ latest first
    });

    // Step 2: Map ASheet + MSheet, fetch fundsWebData using client contact info
    const combinedResults = await Promise.all(
      msheets.map(async (m) => {
        const row = m.toJSON();
        const asheet = row.ASheet || {};

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

        // Merge ASheet top-level + nested MSheet + fundsWebData
        return { ...asheet, MSheet: { ...row }, fundsWebData };
      })
    );

    // Step 3: Filter invalid C4 status
    const cleanedArray = combinedResults.filter(
      (item) =>
        !item.c4Status ||
        (item.c4Status &&
          item.c4Status.trim() !== "" &&
          item.c4Status.trim().toLowerCase() !== "null")
    );

    // Step 4: Fetch all users for response
    const allUsers = await model.User.findAll({
      attributes: ["id", "firstName", "lastName", "email", "phoneNumber"],
    });

    const users = allUsers.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      mobileNumber: u.phoneNumber,
      name: `${u.firstName} ${u.lastName}`.trim(),
    }));

    // Step 5: Return response
    return ReS(
      res,
      {
        success: true,
        total: cleanedArray.length,
        data: cleanedArray,
        users,
      },
      200
    );
  } catch (error) {
    console.error("fetchSubscriptionC1AndMSheetDetailsByRM Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchSubscriptionC1AndMSheetDetailsByRM =
  fetchSubscriptionC1AndMSheetDetailsByRM;
