"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const moment = require("moment-timezone");
const { resolveSourceValue } = require("../utils/achievement.service");
const { calculateFinal } = require("../utils/calculation.service");


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

"use strict";
// ─────────────────────────────────────────────
var calculateAchievement = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate config id
    if (!id) return ReE(res, "Config ID is required", 400);

    // Fetch the config
    const config = await model.FundConfig.findOne({
      where: { id, isDeleted: false },
    });

    if (!config) return ReE(res, "Fund config not found", 404);

    const { managerId, periodMonth, periodYear, departments, ratings, retentionRate, targetCoins } =
      config;

    // Validate period
    if (!periodMonth || !periodYear)
      return ReE(res, "Config is missing periodMonth or periodYear", 400);

    // ── Step 1: Resolve real DB values for each metric ──
    const resolvedDepartments = await Promise.all(
      departments.map(async (dept) => {
        const resolvedMetrics = await Promise.all(
          dept.metrics.map(async (metric) => {
            let realValue = 0;

            if (metric.source && metric.source !== "MANUAL") {
              // Fetch actual count from DB based on source key
              realValue = await resolveSourceValue(
                metric.source,
                managerId,
                periodMonth,
                periodYear
              );
            } else if (metric.source === "MANUAL" && metric.value != null) {
              // Manual metric — use whatever value admin stored
              realValue = parseFloat(metric.value) || 0;
            }

            return {
              ...metric,
              value: realValue, // override with real value
            };
          })
        );

        return {
          ...dept,
          metrics: resolvedMetrics,
        };
      })
    );

    // ── Step 2: Build config object for calculateFinal ──
    const configForCalc = {
      departments: resolvedDepartments,
      ratings,
      retentionRate: parseFloat(retentionRate),
      targetCoins: parseFloat(targetCoins),
    };

    // ── Step 3: Run full calculation ──
    const calculationResult = calculateFinal(configForCalc);

    // ── Step 4: Upsert into FundResult ──
    const existingResult = await model.FundResult.findOne({
      where: { configId: id, isDeleted: false },
    });

    if (existingResult) {
      // Update existing result
      await existingResult.update({
        deptBreakdown: calculationResult.deptBreakdown,
        weightedTotalCoins: calculationResult.weightedTotalCoins,
        retentionMultiplier: calculationResult.retentionMultiplier,
        coinsAfterRetention: calculationResult.coinsAfterRetention,
        finalRating: calculationResult.finalRating,
        behaviorLevel: calculationResult.behaviorLevel,
        behaviorMultiplier: calculationResult.behaviorMultiplier,
        finalCoins: calculationResult.finalCoins,
        achievementPercent: calculationResult.achievementPercent,
        performanceCategory: calculationResult.performanceCategory,
      });
    } else {
      // Create fresh result
      await model.FundResult.create({
        configId: id,
        deptBreakdown: calculationResult.deptBreakdown,
        weightedTotalCoins: calculationResult.weightedTotalCoins,
        retentionMultiplier: calculationResult.retentionMultiplier,
        coinsAfterRetention: calculationResult.coinsAfterRetention,
        finalRating: calculationResult.finalRating,
        behaviorLevel: calculationResult.behaviorLevel,
        behaviorMultiplier: calculationResult.behaviorMultiplier,
        finalCoins: calculationResult.finalCoins,
        achievementPercent: calculationResult.achievementPercent,
        performanceCategory: calculationResult.performanceCategory,
      });
    }

    // ── Step 5: Fetch fresh result to return ──
    const savedResult = await model.FundResult.findOne({
      where: { configId: id, isDeleted: false },
    });

    // ── Step 6: Build summary for frontend ──
    const coinsEarned = parseFloat(calculationResult.finalCoins);
    const coinsTarget = parseFloat(targetCoins);
    const coinsRemaining = Math.max(0, coinsTarget - coinsEarned);

    const summary = {
      targetCoins: coinsTarget,
      coinsEarned: parseFloat(coinsEarned.toFixed(2)),
      coinsRemaining: parseFloat(coinsRemaining.toFixed(2)),
      achievementPercent: calculationResult.achievementPercent,
      performanceCategory: calculationResult.performanceCategory,
      behaviorLevel: calculationResult.behaviorLevel,
      periodMonth,
      periodYear,
    };

    return ReS(
      res,
      {
        success: true,
        message: "Achievement calculated successfully",
        summary,
        result: {
          ...savedResult.dataValues,
          createdAt: moment(savedResult.createdAt)
            .tz("Asia/Kolkata")
            .format("YYYY-MM-DD HH:mm:ss"),
          updatedAt: moment(savedResult.updatedAt)
            .tz("Asia/Kolkata")
            .format("YYYY-MM-DD HH:mm:ss"),
        },
        resolvedDepartments, // so frontend can see what real values were fetched
      },
      200
    );
  } catch (error) {
    console.error("Calculate Achievement Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.calculateAchievement = calculateAchievement;

