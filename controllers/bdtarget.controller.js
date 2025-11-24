"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

/* ---------------------------------------------------
   🔥 1. handleBdTargets  (Create + Update + Fetch)
--------------------------------------------------- */
var handleBdTargets = async function (req, res) {
  try {
    let { teamManagerId, startDate, endDate, month, targets } = req.body;
    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

    teamManagerId = parseInt(teamManagerId, 10);
    const today = new Date();

    // Handle month input
    if (month) {
      const [year, mon] = month.split("-");
      startDate = new Date(year, mon - 1, 1);
      endDate = new Date(year, mon, 0);
    }

    // Default to current month
    if (!startDate || !endDate) {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else {
      startDate = new Date(startDate);
      endDate = new Date(endDate);
    }

    // Generate date list
    const dateList = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dateList.push({
        date: d.toISOString().split("T")[0],
        day: d.toLocaleDateString("en-US", { weekday: "long" }),
        internsAllocated: 0,
        internsActive: 0,
        accounts: 0,
      });
    }

    // Upsert bd targets
    if (targets && Array.isArray(targets)) {
      for (let t of targets) {
        const { date, internsAllocated, internsActive, accounts } = t;
        const targetDate = new Date(date);

        let existing = await model.BdTarget.findOne({
          where: { teamManagerId, targetDate },
        });

        if (existing) {
          existing.internsAllocated = internsAllocated ?? existing.internsAllocated;
          existing.internsActive = internsActive ?? existing.internsActive;
          existing.accounts = accounts ?? existing.accounts;
          await existing.save();
        } else {
          await model.BdTarget.create({
            teamManagerId,
            targetDate,
            internsAllocated: internsAllocated || 0,
            internsActive: internsActive || 0,
            accounts: accounts || 0,
          });
        }
      }
    }

    // Fetch existing targets
    const existingTargets = await model.BdTarget.findAll({
      where: {
        teamManagerId,
        targetDate: { [Op.between]: [startDate, endDate] },
      },
    });

    // Merge
    const merged = dateList.map((d) => {
      const found = existingTargets.find(
        (t) => new Date(t.targetDate).toISOString().split("T")[0] === d.date
      );
      return {
        ...d,
        internsAllocated: found ? found.internsAllocated : d.internsAllocated,
        internsActive: found ? found.internsActive : d.internsActive,
        accounts: found ? found.accounts : d.accounts,
      };
    });

    // Totals
    const totals = {
      internsAllocated: merged.reduce((sum, t) => sum + t.internsAllocated, 0),
      internsActive: merged.reduce((sum, t) => sum + t.internsActive, 0),
      accounts: merged.reduce((sum, t) => sum + t.accounts, 0),
    };

    return ReS(res, { success: true, dates: merged, totals }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.handleBdTargets = handleBdTargets;

/* ---------------------------------------------------
   🔥 2. fetchBdTargets (Fetch-only version)
--------------------------------------------------- */
var fetchBdTargets = async function (req, res) {
  try {
    let { teamManagerId, startDate, endDate, month } = req.query;
    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

    teamManagerId = parseInt(teamManagerId, 10);

    const today = new Date();
    let sDate, eDate;

    if (month) {
      const [year, mon] = month.split("-");
      sDate = new Date(year, mon - 1, 1);
      eDate = new Date(year, mon, 0);
    } else if (startDate && endDate) {
      sDate = new Date(startDate);
      eDate = new Date(endDate);
    } else {
      sDate = new Date(today.getFullYear(), today.getMonth(), 1);
      eDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    // Generate date list
    const dateList = [];
    for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
      const cur = new Date(d);
      dateList.push({
        date: cur.toLocaleDateString("en-CA"),
        day: cur.toLocaleDateString("en-US", { weekday: "long" }),
        internsAllocated: 0,
        internsActive: 0,
        accounts: 0,
      });
    }

    // Fetch existing
    const existingTargets = await model.BdTarget.findAll({
      where: {
        teamManagerId,
        targetDate: { [Op.between]: [sDate, eDate] },
      },
    });

    // Merge
    const merged = dateList.map((d) => {
      const found = existingTargets.find((t) => {
        const tDate = new Date(t.targetDate).toLocaleDateString("en-CA");
        return tDate === d.date;
      });
      return {
        ...d,
        internsAllocated: found ? found.internsAllocated : d.internsAllocated,
        internsActive: found ? found.internsActive : d.internsActive,
        accounts: found ? found.accounts : d.accounts,
      };
    });

    // Totals
    const totals = {
      internsAllocated: merged.reduce((sum, t) => sum + t.internsAllocated, 0),
      internsActive: merged.reduce((sum, t) => sum + t.internsActive, 0),
      accounts: merged.reduce((sum, t) => sum + t.accounts, 0),
    };

    return ReS(res, { success: true, dates: merged, totals }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchBdTargets = fetchBdTargets;
