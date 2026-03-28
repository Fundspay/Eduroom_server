"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const moment = require("moment-timezone");

// ─────────────────────────────────────────────
// 1. CREATE — Admin sets targets + weights only
// ─────────────────────────────────────────────
var createConfig = async (req, res) => {
  try {
    const {
      managerId,
      employeeName,
      employeeEmail,
      position,
      targetCoins,
      departments,
      ratings,
      retentionRate,
      periodMonth,
      periodYear,
    } = req.body;

    if (!managerId || !employeeName || !position || !targetCoins || !departments || !ratings || !retentionRate) {
      return ReE(res, "managerId, employeeName, position, targetCoins, departments, ratings and retentionRate are required", 400);
    }

    if (!Array.isArray(departments) || departments.length === 0) {
      return ReE(res, "departments must be a non-empty array", 400);
    }

    if (!Array.isArray(ratings) || ratings.length === 0) {
      return ReE(res, "ratings must be a non-empty array", 400);
    }

    // Save config — no calculation at this stage
    const config = await model.FundConfig.create({
      managerId,
      employeeName: employeeName.toString(),
      employeeEmail: employeeEmail ? employeeEmail.toString() : null,
      position: position.toString(),
      targetCoins,
      departments,
      ratings,
      retentionRate,
      periodMonth: periodMonth || null,
      periodYear: periodYear || null,
    });

    return ReS(res, { success: true, message: "Fund config created successfully", data: config }, 201);
  } catch (error) {
    console.error("createConfig Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.createConfig = createConfig;

// ─────────────────────────────────────────────
// 2. GET ONE — fetch config only
// ─────────────────────────────────────────────
var getConfig = async (req, res) => {
  try {
    const { id } = req.params;

    const config = await model.FundConfig.findOne({
      where: { id, isDeleted: false },
    });

    if (!config) return ReE(res, "Fund config not found", 404);

    const formattedConfig = {
      ...config.dataValues,
      createdAt: moment(config.createdAt).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
      updatedAt: moment(config.updatedAt).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
    };

    return ReS(res, { success: true, data: formattedConfig }, 200);
  } catch (error) {
    console.error("getConfig Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getConfig = getConfig;

// ─────────────────────────────────────────────
// 3. GET ALL — list all configs for a manager
// ─────────────────────────────────────────────
var getAllConfigs = async (req, res) => {
  try {
    const { managerId } = req.body;

    if (!managerId) return ReE(res, "managerId is required", 400);

    const configs = await model.FundConfig.findAll({
      where: { managerId, isDeleted: false },
      order: [["createdAt", "DESC"]],
    });

    const formattedConfigs = configs.map((config) => ({
      ...config.dataValues,
      createdAt: moment(config.createdAt).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
      updatedAt: moment(config.updatedAt).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
    }));

    return ReS(res, { success: true, count: configs.length, data: formattedConfigs }, 200);
  } catch (error) {
    console.error("getAllConfigs Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getAllConfigs = getAllConfigs;

// ─────────────────────────────────────────────
// 4. UPDATE — update targets + weights only
// ─────────────────────────────────────────────
var updateConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employeeName,
      employeeEmail,
      position,
      targetCoins,
      departments,
      ratings,
      retentionRate,
      periodMonth,
      periodYear,
    } = req.body;

    const config = await model.FundConfig.findOne({ where: { id, isDeleted: false } });
    if (!config) return ReE(res, "Fund config not found", 404);

    // Update config with new values — no recalculation at this stage
    await config.update({
      employeeName: employeeName || config.employeeName,
      employeeEmail: employeeEmail || config.employeeEmail,
      position: position || config.position,
      targetCoins: targetCoins || config.targetCoins,
      departments: departments || config.departments,
      ratings: ratings || config.ratings,
      retentionRate: retentionRate || config.retentionRate,
      periodMonth: periodMonth || config.periodMonth,
      periodYear: periodYear || config.periodYear,
    });

    return ReS(res, { success: true, message: "Fund config updated successfully" }, 200);
  } catch (error) {
    console.error("updateConfig Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.updateConfig = updateConfig;

// ─────────────────────────────────────────────
// 5. DELETE — soft delete config + its result
// ─────────────────────────────────────────────
var deleteConfig = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) return ReE(res, "Missing required ID", 400);

    const config = await model.FundConfig.findOne({ where: { id, isDeleted: false } });
    if (!config) return ReE(res, "Fund config not found", 404);

    // Soft delete config
    config.isDeleted = true;
    await config.save();

    // Soft delete linked result if exists
    await model.FundResult.update({ isDeleted: true }, { where: { configId: id } });

    return ReS(res, { success: true, message: "Fund config deleted successfully" }, 200);
  } catch (error) {
    console.error("deleteConfig Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.deleteConfig = deleteConfig;