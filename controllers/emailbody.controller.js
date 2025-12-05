"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

var upsertJDTemplate = async (req, res) => {
  try {
    const { internshipType, body } = req.body;

    if (!internshipType) {
      return ReE(res, "internshipType is required", 400);
    }

    if (!body) {
      return ReE(res, "Body is required", 400);
    }

    // sanitize internshipType
    const cleanType = internshipType.trim().toLowerCase().replace(/\s+/g, "");

    // dynamic unique key
    const key = `jd_email_template_${cleanType}`;

    // Upsert template with subject as NULL
    const [template] = await model.EmailTemplate.upsert(
      {
        key,
        subject: null,   // 👈 IMPORTANT: Allow subject to be null
        body
      },
      { returning: true }
    );

    return ReS(
      res,
      { message: "Template saved successfully", template },
      200
    );

  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.upsertJDTemplate = upsertJDTemplate;


// GET JD EMAIL TEMPLATE
var getJDTemplate = async (req, res) => {
  try {
    const template = await model.EmailTemplate.findOne({
      where: { key: "jd_email_template" }
    });

    if (!template) return ReE(res, "Template not found", 404);

    return ReS(res, template, 200);

  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.getJDTemplate = getJDTemplate;