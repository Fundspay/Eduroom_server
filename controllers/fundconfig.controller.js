"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const moment = require("moment-timezone");
const { resolveSourceValue, getRetentionRate } = require("../utils/achievement.service");
const { calculateFinal } = require("../utils/calculation.service");


// ─────────────────────────────────────────────
// 1. CREATE — Admin sets targets + weights only
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 1. CREATE — Admin sets targets + weights only
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 1. UPSERT — create or update config for same manager + period
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
      periodMonth,
      periodYear,
    } = req.body;

    // Validate required fields — retentionRate removed (auto-calculated from DB)
    if (!managerId || !employeeName || !position || !targetCoins || !departments || !ratings) {
      return ReE(res, "managerId, employeeName, position, targetCoins, departments and ratings are required", 400);
    }

    if (!Array.isArray(departments) || departments.length === 0) {
      return ReE(res, "departments must be a non-empty array", 400);
    }

    if (!Array.isArray(ratings) || ratings.length === 0) {
      return ReE(res, "ratings must be a non-empty array", 400);
    }

    // Check if config already exists for same manager + period
    const existing = await model.FundConfig.findOne({
      where: {
        managerId,
        periodMonth: periodMonth || null,
        periodYear: periodYear || null,
        isDeleted: false,
      },
    });

    if (existing) {
      // Update existing config
      await existing.update({
        employeeName: employeeName.toString(),
        employeeEmail: employeeEmail ? employeeEmail.toString() : null,
        position: position.toString(),
        targetCoins,
        departments,
        ratings,
      });

      return ReS(res, { success: true, message: "Fund config updated successfully", data: existing }, 200);
    }

    // Create fresh config
    const config = await model.FundConfig.create({
      managerId,
      employeeName: employeeName.toString(),
      employeeEmail: employeeEmail ? employeeEmail.toString() : null,
      position: position.toString(),
      targetCoins,
      departments,
      ratings,
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
// ─────────────────────────────────────────────
// 2. GET ONE — fetch config + all team managers
// ─────────────────────────────────────────────
var getConfig = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch config
    const config = await model.FundConfig.findOne({
      where: { id, isDeleted: false },
    });
    if (!config) return ReE(res, "Fund config not found", 404);

    // Fetch all active team managers
    const teamManagers = await model.TeamManager.findAll({
      where: { isDeleted: false, isActive: true },
      attributes: ["id", "managerId", "name", "email", "department", "position"],
      order: [["name", "ASC"]],
    });

    const formattedConfig = {
      ...config.dataValues,
      createdAt: moment(config.createdAt).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
      updatedAt: moment(config.updatedAt).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
    };

    return ReS(res, { success: true, data: formattedConfig, teamManagers }, 200);
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
// 2. GET ONE — fetch config + all team managers
// if no id given — return only all team managers
// if id given — return config + all team managers
// ─────────────────────────────────────────────
var getConfig = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch all active team managers (always returned)
    const teamManagers = await model.TeamManager.findAll({
      where: { isDeleted: false, isActive: true },
      attributes: ["id", "managerId", "name", "email", "department", "position"],
      order: [["name", "ASC"]],
    });

    // No id given — just return team managers
    if (!id) {
      return ReS(res, { success: true, teamManagers }, 200);
    }

    // Id given — fetch config too
    const config = await model.FundConfig.findOne({
      where: { id, isDeleted: false },
    });
    if (!config) return ReE(res, "Fund config not found", 404);

    const formattedConfig = {
      ...config.dataValues,
      createdAt: moment(config.createdAt).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
      updatedAt: moment(config.updatedAt).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
    };

    return ReS(res, { success: true, data: formattedConfig, teamManagers }, 200);
  } catch (error) {
    console.error("getConfig Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getConfig = getConfig;

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


// ─────────────────────────────────────────────
// ADD THESE IMPORTS at the top of fundConfigController.js
// (if not already added)
// ─────────────────────────────────────────────
// const { resolveSourceValue } = require("../utils/achievement.service");
// const { calculateFinal } = require("../utils/calculation.service");

// ─────────────────────────────────────────────
// 7. FINAL REPORT — full fundcoins report with everything
// POST /api/fund-config/final-report/:id
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
var finalReport = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) return ReE(res, "Config ID is required", 400);

    // ── Step 1: Fetch FundConfig ──
    const config = await model.FundConfig.findOne({
      where: { id, isDeleted: false },
    });
    if (!config) return ReE(res, "Fund config not found", 404);

    const {
      managerId,
      employeeName,
      employeeEmail,
      position,
      periodMonth,
      periodYear,
      departments,
      ratings,
      targetCoins,
    } = config;

    if (!periodMonth || !periodYear)
      return ReE(res, "Config is missing periodMonth or periodYear", 400);

    // ── Step 2: Auto-calculate retention rate from DB ──
    // retentionRate = (activeInterns / totalAllocated) * 100
    const retentionRate = await getRetentionRate(managerId, periodMonth, periodYear);

    // ── Step 3: Resolve real achieved values from DB per metric ──
    const resolvedDepartments = await Promise.all(
      departments.map(async (dept) => {
        const resolvedMetrics = await Promise.all(
          dept.metrics.map(async (metric) => {
            let realValue = 0;

            if (metric.source && metric.source !== "MANUAL") {
              realValue = await resolveSourceValue(
                metric.source,
                managerId,
                periodMonth,
                periodYear
              );
            } else if (metric.source === "MANUAL" && metric.value != null) {
              realValue = parseFloat(metric.value) || 0;
            }

            return {
              ...metric,
              value: realValue,
            };
          })
        );

        return {
          ...dept,
          metrics: resolvedMetrics,
        };
      })
    );

    // ── Step 4: Fetch manager name to find interns via Status table ──
    const managerRecord = await model.TeamManager.findByPk(managerId, {
      attributes: ["name"],
    });
    const managerName = managerRecord ? managerRecord.name : null;

    // ── Step 5: Get all intern userIds under this manager from Status table ──
    let internAvgRating = 0;
    let internReviewCount = 0;
    let internBreakdown = [];

    if (managerName) {
      const statuses = await model.Status.findAll({
        where: { teamManager: managerName },
        attributes: ["userId"],
        raw: true,
      });

      const internUserIds = statuses.map((s) => s.userId);

      if (internUserIds.length > 0) {
        // For each intern, fetch their analysis1 records and calculate avg rating
        const internRatings = await Promise.all(
          internUserIds.map(async (uid) => {
            const days = await model.analysis1.findAll({
              where: {
                user_id: uid,
                isRated: true,
              },
              attributes: ["day_no", "starRating", "ratingComment"],
              raw: true,
            });

            if (!days.length) return null;

            const avg = parseFloat(
              (
                days.reduce((sum, d) => sum + parseFloat(d.starRating), 0) /
                days.length
              ).toFixed(2)
            );

            return {
              userId: uid,
              ratedDays: days.length,
              avgRating: avg,
              days: days.map((d) => ({
                dayNo: d.day_no,
                starRating: parseFloat(d.starRating),
                ratingComment: d.ratingComment || null,
              })),
            };
          })
        );

        // Filter out interns with no ratings
        internBreakdown = internRatings.filter((r) => r !== null);
        internReviewCount = internBreakdown.length;

        if (internReviewCount > 0) {
          // Overall avg across all interns
          internAvgRating = parseFloat(
            (
              internBreakdown.reduce((sum, r) => sum + r.avgRating, 0) /
              internReviewCount
            ).toFixed(2)
          );
        }
      }
    }

    // ── Step 6: Auto-fetch other 360° ratings from ManagerReviews ──
    // (peer, cross, manager, leadership — NOT intern, that comes from analysis1)
    const reviewRows = await model.ManagerReview.findAll({
      where: {
        targetManagerId: managerId,
        periodMonth,
        periodYear,
        reviewerType: { [require("sequelize").Op.ne]: "intern" }, // exclude intern — handled separately
        isDeleted: false,
      },
      attributes: ["reviewerType", "starRating"],
      raw: true,
    });

    // Group and average by reviewerType
    const grouped = {};
    reviewRows.forEach((r) => {
      if (!grouped[r.reviewerType]) grouped[r.reviewerType] = [];
      grouped[r.reviewerType].push(parseFloat(r.starRating));
    });

    const avgByType = {};
    Object.keys(grouped).forEach((type) => {
      const arr = grouped[type];
      avgByType[type] = parseFloat(
        (arr.reduce((sum, v) => sum + v, 0) / arr.length).toFixed(2)
      );
    });

    // Override intern avg with real value from analysis1
    avgByType["intern"] = internAvgRating;

    // ── Step 7: Merge real avg values into ratings array from config ──
    const mergedRatings = ratings.map((r) => ({
      ...r,
      value: avgByType[r.key] !== undefined ? avgByType[r.key] : parseFloat(r.value) || 0,
      reviewCount: r.key === "intern" ? internReviewCount : (grouped[r.key] ? grouped[r.key].length : 0),
    }));

    // ── Step 8: Run full calculateFinal with real data ──
    const configForCalc = {
      departments: resolvedDepartments,
      ratings: mergedRatings,
      retentionRate: retentionRate,
      targetCoins: parseFloat(targetCoins),
    };

    const calc = calculateFinal(configForCalc);

    // ── Step 9: Upsert into FundResult ──
    const existingResult = await model.FundResult.findOne({
      where: { configId: id, isDeleted: false },
    });

    if (existingResult) {
      await existingResult.update({
        deptBreakdown: calc.deptBreakdown,
        weightedTotalCoins: calc.weightedTotalCoins,
        retentionMultiplier: calc.retentionMultiplier,
        coinsAfterRetention: calc.coinsAfterRetention,
        finalRating: calc.finalRating,
        behaviorLevel: calc.behaviorLevel,
        behaviorMultiplier: calc.behaviorMultiplier,
        finalCoins: calc.finalCoins,
        achievementPercent: calc.achievementPercent,
        performanceCategory: calc.performanceCategory,
      });
    } else {
      await model.FundResult.create({
        configId: id,
        deptBreakdown: calc.deptBreakdown,
        weightedTotalCoins: calc.weightedTotalCoins,
        retentionMultiplier: calc.retentionMultiplier,
        coinsAfterRetention: calc.coinsAfterRetention,
        finalRating: calc.finalRating,
        behaviorLevel: calc.behaviorLevel,
        behaviorMultiplier: calc.behaviorMultiplier,
        finalCoins: calc.finalCoins,
        achievementPercent: calc.achievementPercent,
        performanceCategory: calc.performanceCategory,
      });
    }

    // ── Step 10: Fetch saved FundResult ──
    const savedResult = await model.FundResult.findOne({
      where: { configId: id, isDeleted: false },
    });

    // ── Step 11: Build dept breakdown for response ──
    const departmentBreakdown = calc.deptBreakdown.map((dept) => ({
      key: dept.key,
      name: dept.name,
      icon: dept.icon,
      deptWeight: dept.deptWeight,
      metrics: dept.metrics.map((m) => ({
        name: m.name,
        source: m.source || "MANUAL",
        achievedValue: m.value,
        multiplier: m.multiplier,
        coinsEarned: parseFloat((m.value * m.multiplier).toFixed(2)),
        weight: m.weight,
        weightedCoins: parseFloat(m.coinsEarned !== undefined ? m.coinsEarned : 0),
      })),
      totalBeforeWeight: parseFloat(dept.totalBeforeWeight.toFixed(2)),
      weightedContribution: parseFloat(dept.weightedContribution.toFixed(2)),
    }));

    // ── Step 12: Build ratings breakdown for response ──
    const ratingsBreakdown = mergedRatings.map((r) => ({
      key: r.key,
      name: r.name,
      weight: r.weight,
      avgRating: r.value,
      reviewCount: r.reviewCount,
      contribution: parseFloat(((r.value * r.weight) / 100).toFixed(4)),
    }));

    // ── Step 13: Build full report response ──
    const coinsEarned = parseFloat(calc.finalCoins);
    const coinsTarget = parseFloat(targetCoins);
    const coinsRemaining = Math.max(0, coinsTarget - coinsEarned);

    const report = {
      // Employee Info
      employeeInfo: {
        managerId,
        employeeName,
        employeeEmail,
        position,
        periodMonth,
        periodYear,
        period: `${String(periodMonth).padStart(2, "0")}/${periodYear}`,
      },

      // Target vs Achieved summary
      summary: {
        targetCoins: coinsTarget,
        finalCoins: parseFloat(coinsEarned.toFixed(2)),
        coinsRemaining: parseFloat(coinsRemaining.toFixed(2)),
        achievementPercent: calc.achievementPercent,
        performanceCategory: calc.performanceCategory,
        behaviorLevel: calc.behaviorLevel,
        behaviorMultiplier: calc.behaviorMultiplier,
        finalRating: calc.finalRating,
      },

      // Department-wise breakdown
      departmentBreakdown,

      // Retention breakdown
      retentionBreakdown: {
        retentionRate: retentionRate,
        retentionMultiplier: calc.retentionMultiplier,
        weightedTotalCoins: parseFloat(calc.weightedTotalCoins.toFixed(2)),
        coinsAfterRetention: parseFloat(calc.coinsAfterRetention.toFixed(2)),
      },

      // 360° ratings breakdown
      ratingsBreakdown,

      // Intern review breakdown — per intern avg
      internReviewBreakdown: {
        totalInternsUnderManager: managerName ? (await model.Status.count({ where: { teamManager: managerName } })) : 0,
        totalInternsRated: internReviewCount,
        overallInternAvgRating: internAvgRating,
        perInternBreakdown: internBreakdown,
      },

      // Full FundResult row
      fundResult: {
        ...savedResult.dataValues,
        createdAt: moment(savedResult.createdAt)
          .tz("Asia/Kolkata")
          .format("YYYY-MM-DD HH:mm:ss"),
        updatedAt: moment(savedResult.updatedAt)
          .tz("Asia/Kolkata")
          .format("YYYY-MM-DD HH:mm:ss"),
      },
    };

    return ReS(
      res,
      {
        success: true,
        message: "Final fund coins report generated successfully",
        data: report,
      },
      200
    );
  } catch (error) {
    console.error("Final Report Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.finalReport = finalReport;