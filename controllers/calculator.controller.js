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
    // Fetch active interns count
    // ---------------------------
    const activeInterns = await model.BdSheet.count({
      where: {
        teamManagerId: managerId,
        module2Status: { [Op.iLike]: "Promoted" },
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

    

    // ---------------------------
    // Fetch manager's slab amounts
    // ---------------------------
    const managerData = await model.ManagerRanges.findOne({
      where: {
        teamManagerId: Number(managerId),
        incentiveAmounts: { [Op.ne]: null },
      },
      attributes: ["incentiveAmounts"],
      order: [["updatedAt", "DESC"]],
    });

    if (!managerData || !managerData.incentiveAmounts) {
      return ReE(res, "No incentive has been set for this user yet", 404);
    }

    let incentiveSlabs = {};
    for (const key in managerData.incentiveAmounts) {
      if (managerData.incentiveAmounts.hasOwnProperty(key)) {
        incentiveSlabs[key.trim()] = managerData.incentiveAmounts[key];
      }
    }

    console.log("INCENTIVE SLABS KEYS:", Object.keys(incentiveSlabs));

    const SLABS = [
      { key: "1-10", min: 1, max: 10 },
      { key: "11-20", min: 11, max: 20 },
      { key: "21-30", min: 21, max: 30 },
      { key: "31-40", min: 31, max: 40 },
      { key: "41-50", min: 41, max: 50 },
      { key: "51-60", min: 51, max: 60 },
      { key: "61-70", min: 61, max: 70 },
      { key: "71-80", min: 71, max: 80 },
      { key: "81-90", min: 81, max: 90 },
      { key: "91-100", min: 91, max: 100 },
      { key: "101-200", min: 101, max: 200 },
      { key: "201-300", min: 201, max: 300 },
      { key: "301-400", min: 301, max: 400 },
      { key: "401-500", min: 401, max: 500 },
      { key: "501-600", min: 501, max: 600 },
      { key: "601+", min: 601, max: 9999 },
    ];

    let selectedSlab = null;
    for (const slab of SLABS) {
      if (activeInterns >= slab.min && activeInterns <= slab.max) {
        selectedSlab = slab.key;
        break;
      }
    }

    // ---------------------------
    // If no matching slab
    // ---------------------------
    if (!selectedSlab) {
      if (activeInterns === 0) {
        return ReS(res, {
          message: "Manager has 0 active interns for this period",
          data: {
            managerId,
            startDate,
            endDate,
            activeInterns: 0,
            slab: null,
            perInternAmount: 0,
            totalIncentive: 0,
            allRanges: SLABS.map((s) => s.key),       // <<< ADDED
            setAmounts: incentiveSlabs,               // <<< ADDED
          },
        });
      }
      return ReE(res, "No matching slab found", 400);
    }

    const slabAmount = incentiveSlabs[selectedSlab] || 0;
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

        // 🔥 ADDED (based on your reference code)
        allRanges: SLABS.map((s) => s.key),
        setAmounts: incentiveSlabs,
      },
    });
  } catch (error) {
    console.log("INCENTIVE CALC ERROR:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.calculateIncentive = calculateIncentive;


const calculateDeduction = async (req, res) => {
  try {
    const { managerId, startDate, endDate } = req.query;

    if (!managerId) return ReE(res, "managerId is required", 400);
    if (!startDate || !endDate)
      return ReE(res, "startDate and endDate are required", 400);

    // ---------------------------
    // Fetch inactive interns count
    // ---------------------------
    const inactiveInterns = await model.BdSheet.count({
      where: {
        teamManagerId: managerId,
        activeStatus: {
          [Op.iLike]: { [Op.any]: ["Inactive", "Left", "Terminated"] }
        },
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


    // ---------------------------
    // Fetch manager deduction slabs
    // ---------------------------
    const managerData = await model.ManagerRanges.findOne({
      where: {
        teamManagerId: Number(managerId),
        deductionAmounts: { [Op.ne]: null },
      },
      attributes: ["deductionAmounts"],
      order: [["updatedAt", "DESC"]],
    });

    if (!managerData || !managerData.deductionAmounts) {
      return ReE(res, "No deduction has been set for this user yet", 404);
    }

    let deductionSlabs = {};
    for (const key in managerData.deductionAmounts) {
      if (managerData.deductionAmounts.hasOwnProperty(key)) {
        deductionSlabs[key.trim()] = managerData.deductionAmounts[key];
      }
    }

    console.log("DEDUCTION SLABS KEYS:", Object.keys(deductionSlabs));

    const SLABS = [
      { key: "1-10", min: 1, max: 10 },
      { key: "11-20", min: 11, max: 20 },
      { key: "21-30", min: 21, max: 30 },
      { key: "31-40", min: 31, max: 40 },
      { key: "41-50", min: 41, max: 50 },
      { key: "51-60", min: 51, max: 60 },
      { key: "61-70", min: 61, max: 70 },
      { key: "71-80", min: 71, max: 80 },
      { key: "81-90", min: 81, max: 90 },
      { key: "91-100", min: 91, max: 100 },
      { key: "101-200", min: 101, max: 200 },
      { key: "201-300", min: 201, max: 300 },
      { key: "301-400", min: 301, max: 400 },
      { key: "401-500", min: 401, max: 500 },
      { key: "501-600", min: 501, max: 600 },
      { key: "601+", min: 601, max: 9999 },
    ];

    let selectedSlab = null;
    for (const slab of SLABS) {
      if (inactiveInterns >= slab.min && inactiveInterns <= slab.max) {
        selectedSlab = slab.key;
        break;
      }
    }

    // ---------------------------
    // If no matching slab
    // ---------------------------
    if (!selectedSlab) {
      if (inactiveInterns === 0) {
        return ReS(res, {
          message: "Manager has 0 inactive interns for this period",
          data: {
            managerId,
            startDate,
            endDate,
            inactiveInterns: 0,
            slab: null,
            perInternAmount: 0,
            totalDeduction: 0,

            // ADDED
            allRanges: SLABS.map((s) => s.key),
            setAmounts: deductionSlabs,
          },
        });
      }
      return ReE(res, "No matching slab found", 400);
    }

    const slabAmount = -(deductionSlabs[selectedSlab] || 0); // convert to negative
    const totalDeduction = inactiveInterns * slabAmount;

    return ReS(res, {
      message: "Deduction calculated successfully",
      data: {
        managerId,
        startDate,
        endDate,
        inactiveInterns,
        slab: selectedSlab,
        perInternAmount: slabAmount,
        totalDeduction,

        // 🔥 ADDED EXACTLY LIKE INCENTIVE
        allRanges: SLABS.map((s) => s.key),
        setAmounts: deductionSlabs,
      },
    });
  } catch (error) {
    console.log("DEDUCTION CALC ERROR:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.calculateDeduction = calculateDeduction;

const getFinalIncentiveDeductionSummary = async (req, res) => {
  try {
    const { managerId, startDate, endDate } = req.query;

    if (!managerId) return ReE(res, "managerId is required", 400);
    if (!startDate || !endDate)
      return ReE(res, "startDate and endDate are required", 400);

    // -----------------------------------------
    // 1️⃣ ACTIVE interns count (same as incentive)
    // -----------------------------------------
    const activeInterns = await model.BdSheet.count({
      where: {
        teamManagerId: managerId,
        module2Status: { [Op.iLike]: "Promoted" },
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

    // Fetch incentive slab amounts
    const incentiveData = await model.ManagerRanges.findOne({
      where: {
        teamManagerId: Number(managerId),
        incentiveAmounts: { [Op.ne]: null },
      },
      attributes: ["incentiveAmounts"],
      order: [["updatedAt", "DESC"]],
    });

    let incentiveSlabs = {};
    if (incentiveData && incentiveData.incentiveAmounts) {
      for (const key in incentiveData.incentiveAmounts) {
        incentiveSlabs[key.trim()] = incentiveData.incentiveAmounts[key];
      }
    }

    const SLABS = [
      { key: "1-10", min: 1, max: 10 },
      { key: "11-20", min: 11, max: 20 },
      { key: "21-30", min: 21, max: 30 },
      { key: "31-40", min: 31, max: 40 },
      { key: "41-50", min: 41, max: 50 },
      { key: "51-60", min: 51, max: 60 },
      { key: "61-70", min: 61, max: 70 },
      { key: "71-80", min: 71, max: 80 },
      { key: "81-90", min: 81, max: 90 },
      { key: "91-100", min: 91, max: 100 },
      { key: "101-200", min: 101, max: 200 },
      { key: "201-300", min: 201, max: 300 },
      { key: "301-400", min: 301, max: 400 },
      { key: "401-500", min: 401, max: 500 },
      { key: "501-600", min: 501, max: 600 },
      { key: "601+", min: 601, max: 9999 },
    ];

    // Find incentive slab
    let selectedIncentiveSlab = null;
    for (const slab of SLABS) {
      if (activeInterns >= slab.min && activeInterns <= slab.max) {
        selectedIncentiveSlab = slab.key;
        break;
      }
    }

    const incentiveAmount =
      selectedIncentiveSlab && incentiveSlabs[selectedIncentiveSlab]
        ? incentiveSlabs[selectedIncentiveSlab]
        : 0;

    const totalIncentiveAmount = activeInterns * incentiveAmount;

    // -----------------------------------------
    // 2️⃣ INACTIVE interns count (deduction)
    // -----------------------------------------
    const inactiveInterns = await model.BdSheet.count({
      where: {
        teamManagerId: managerId,
        activeStatus: {
          [Op.iLike]: { [Op.any]: ["Inactive", "Left", "Terminated"] },
        },
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

    // Fetch deduction slab amounts
    const deductionData = await model.ManagerRanges.findOne({
      where: {
        teamManagerId: Number(managerId),
        deductionAmounts: { [Op.ne]: null },
      },
      attributes: ["deductionAmounts"],
      order: [["updatedAt", "DESC"]],
    });

    let deductionSlabs = {};
    if (deductionData && deductionData.deductionAmounts) {
      for (const key in deductionData.deductionAmounts) {
        deductionSlabs[key.trim()] = deductionData.deductionAmounts[key];
      }
    }

    // Find deduction slab
    let selectedDeductionSlab = null;
    for (const slab of SLABS) {
      if (inactiveInterns >= slab.min && inactiveInterns <= slab.max) {
        selectedDeductionSlab = slab.key;
        break;
      }
    }

    const deductionAmount =
      selectedDeductionSlab && deductionSlabs[selectedDeductionSlab]
        ? -deductionSlabs[selectedDeductionSlab] // convert to negative
        : 0;

    const totalDeductionAmount = inactiveInterns * deductionAmount;

    // -----------------------------------------
    // 3️⃣ FINAL TOTAL
    // -----------------------------------------
    const finalAmount = totalIncentiveAmount + totalDeductionAmount;

    return ReS(res, {
      message: "Final summary calculated successfully",
      data: {
        managerId,
        startDate,
        endDate,

        totalInternsInIncentive: activeInterns,
        totalInternsInDeduction: inactiveInterns,

        totalIncentiveAmount,
        totalDeductionAmount,

        finalAmount,
      },
    });
  } catch (error) {
    console.log("FINAL SUMMARY ERROR:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getFinalIncentiveDeductionSummary = getFinalIncentiveDeductionSummary;





