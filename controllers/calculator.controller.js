"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, Sequelize } = require("sequelize");

// ---------------------------
// Incentive Calculator
// ---------------------------
const RANGE_KEYS = ["1-10", "11-20", "21-30", "31-40", "41-45", "46+"];

const calculateIncentive = async (req, res) => {
  try {
    const { managerId, startDate, endDate } = req.query;

    if (!managerId) return ReE(res, "managerId is required", 400);
    if (!startDate || !endDate)
      return ReE(res, "startDate and endDate are required", 400);

    // ---------------------------
    // Fetch active interns count
    // ---------------------------
    const sheetDateFilter = {
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
    };

    const activeInterns = await model.BdSheet.count({
      where: {
        teamManagerId: managerId,
        activeStatus: "active",
        ...sheetDateFilter,
      },
    });

    console.log("Active Interns Count:", activeInterns);

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
    // Ensure all slab amounts are numbers
    // ---------------------------
    const incentiveSlabs = {};
    for (const key of RANGE_KEYS) {
      const val = managerData.incentiveAmounts[key];
      incentiveSlabs[key] = Number(val) || 0;
    }

    console.log("Incentive Slabs:", incentiveSlabs);

    // ----------------------------------------
    // Hardcoded RANGE KEYS
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
      console.log("No matching slab for count:", activeInterns);
      return ReE(res, "No matching slab found", 400);
    }

    const slabAmount = incentiveSlabs[selectedSlab];

    // Final Calculation
    const totalIncentive = activeInterns * slabAmount;

    console.log("Selected Slab:", selectedSlab, "Per Intern Amount:", slabAmount, "Total Incentive:", totalIncentive);

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
