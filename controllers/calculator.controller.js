"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, Sequelize } = require("sequelize");

// ---------------------------
// Incentive Calculator
// ---------------------------
const calculateIncentive = async (req, res) => {
  try {
    const { managerId, startDate, endDate } = req.query;

    if (!managerId) return ReE(res, "managerId is required", 400);
    if (!startDate || !endDate)
      return ReE(res, "startDate and endDate are required", 400);

    // ---------------------------
    // Fetch active interns count (case-insensitive)
    // ---------------------------
    const activeInterns = await model.BdSheet.count({
      where: {
        teamManagerId: managerId,
        activeStatus: { [Op.iLike]: "active" },
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn("DATE", Sequelize.col("startDate")),
            ">=",
            startDate
          ),
          Sequelize.where(
            Sequelize.fn("DATE", Sequelize.col("startDate")),
            "<=",
            endDate
          ),
        ],
      },
    });

    console.log("ACTIVE INTERNS COUNT:", activeInterns);

    // ---------------------------
    // Fetch manager's slab amounts
    // ---------------------------
    const managerData = await model.BdSheet.findOne({
      where: { teamManagerId: managerId },
      attributes: ["incentiveAmounts"],
    });

    if (!managerData || !managerData.incentiveAmounts) {
      return ReE(res, "No incentive slabs found for this manager", 404);
    }

    // ---------------------------
    // Convert all incentive amounts to numbers
    // ---------------------------
    let incentiveSlabs = {};
    for (const key in managerData.incentiveAmounts) {
      if (managerData.incentiveAmounts.hasOwnProperty(key)) {
        const value = managerData.incentiveAmounts[key];
        // Ensure number type
        incentiveSlabs[key.trim()] = Number(value) || 0;
      }
    }

    console.log("INCENTIVE SLABS KEYS:", Object.keys(incentiveSlabs));
    console.log("INCENTIVE SLABS VALUES:", Object.values(incentiveSlabs));

    // ----------------------------------------
    // Hardcoded RANGE KEYS (must match DB keys)
    // ----------------------------------------
    const SLABS = [
      { key: "1-10", min: 1, max: 10 },
      { key: "11-20", min: 11, max: 20 },
      { key: "21-30", min: 21, max: 30 },
      { key: "31-40", min: 31, max: 40 },
      { key: "41-45", min: 41, max: 45 },
      { key: "46+", min: 46, max: 9999 },
    ];

    // ---------------------------
    // Find correct slab based on count
    // ---------------------------
    let selectedSlab = null;
    for (const slab of SLABS) {
      if (activeInterns >= slab.min && activeInterns <= slab.max) {
        selectedSlab = slab.key;
        break;
      }
    }

    if (!selectedSlab) {
      return ReE(res, "No matching slab found", 400);
    }

    // Slab amount from DB (now guaranteed number)
    const slabAmount = incentiveSlabs[selectedSlab];

    // Final Calculation
    const totalIncentive = activeInterns * slabAmount;

    return ReS(res, {
      message: "Incentive calculated successfully",
      data: {
        managerId,
        startDate,
        endDate,
        activeInterns,
        slab: selectedSlab,
        perInternAmount: slabAmount,
        totalIncentive,
      },
    });
  } catch (error) {
    console.log("INCENTIVE CALC ERROR:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.calculateIncentive = calculateIncentive;

