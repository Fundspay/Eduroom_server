"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

var handleTargets = async function (req, res) {
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
        jds: 0,
        calls: 0,
        followUps: 0,
        resumetarget: 0,
        collegeTarget: 0,
        interviewsTarget: 0,
        resumesReceivedTarget: 0,
        interviewConductedTarget: 0,
      });
    }

    // Upsert targets if provided
    if (targets && Array.isArray(targets)) {
      for (let t of targets) {
        const {
          date,
          jds,
          calls,
          followUps,
          resumetarget,
          collegeTarget,
          interviewsTarget,
          resumesReceivedTarget,
          interviewConductedTarget,
        } = t;
        const targetDate = new Date(date);

        let existing = await model.MyTarget.findOne({
          where: { teamManagerId, targetDate },
        });

        if (existing) {
          existing.jds = jds ?? existing.jds;
          existing.calls = calls ?? existing.calls;
          existing.followUps = followUps ?? existing.followUps;
          existing.resumetarget = resumetarget ?? existing.resumetarget;
          existing.collegeTarget = collegeTarget ?? existing.collegeTarget;
          existing.interviewsTarget = interviewsTarget ?? existing.interviewsTarget;
          existing.resumesReceivedTarget = resumesReceivedTarget ?? existing.resumesReceivedTarget;
          existing.interviewConductedTarget = interviewConductedTarget ?? existing.interviewConductedTarget;
          await existing.save();
        } else {
          await model.MyTarget.create({
            teamManagerId,
            targetDate,
            jds: jds || 0,
            calls: calls || 0,
            followUps: followUps || 0,
            resumetarget: resumetarget || 0,
            collegeTarget: collegeTarget || 0,
            interviewsTarget: interviewsTarget || 0,
            resumesReceivedTarget: resumesReceivedTarget || 0,
            interviewConductedTarget: interviewConductedTarget || 0,
          });
        }
      }
    }

    // Fetch existing targets in range
    const existingTargets = await model.MyTarget.findAll({
      where: {
        teamManagerId,
        targetDate: { [Op.between]: [startDate, endDate] },
      },
    });

    // Merge existing targets into dateList
    const merged = dateList.map((d) => {
      const found = existingTargets.find(
        (t) => new Date(t.targetDate).toISOString().split("T")[0] === d.date
      );
      return {
        ...d,
        jds: found ? found.jds : d.jds,
        calls: found ? found.calls : d.calls,
        followUps: found ? found.followUps : d.followUps,
        resumetarget: found ? found.resumetarget : d.resumetarget,
        collegeTarget: found ? found.collegeTarget : d.collegeTarget,
        interviewsTarget: found ? found.interviewsTarget : d.interviewsTarget,
        resumesReceivedTarget: found ? found.resumesReceivedTarget : d.resumesReceivedTarget,
        interviewConductedTarget: found ? found.interviewConductedTarget : d.interviewConductedTarget,
      };
    });

    // Compute totals
    const totals = {
      jds: merged.reduce((sum, t) => sum + t.jds, 0),
      calls: merged.reduce((sum, t) => sum + t.calls, 0),
      followUps: merged.reduce((sum, t) => sum + t.followUps, 0),
      resumetarget: merged.reduce((sum, t) => sum + t.resumetarget, 0),
      collegeTarget: merged.reduce((sum, t) => sum + t.collegeTarget, 0),
      interviewsTarget: merged.reduce((sum, t) => sum + t.interviewsTarget, 0),
      resumesReceivedTarget: merged.reduce((sum, t) => sum + t.resumesReceivedTarget, 0),
      interviewConductedTarget: merged.reduce((sum, t) => sum + t.interviewConductedTarget, 0),
    };

    return ReS(res, { success: true, dates: merged, totals }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.handleTargets = handleTargets;

var fetchTargets = async function (req, res) {
  try {
    let { teamManagerId, startDate, endDate, month } = req.query;
    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

    teamManagerId = parseInt(teamManagerId, 10);

    const today = new Date();
    let sDate, eDate;

    // Month handling
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
      const current = new Date(d);
      dateList.push({
        date: current.toLocaleDateString("en-CA"),
        day: current.toLocaleDateString("en-US", { weekday: "long" }),
        jds: 0,
        calls: 0,
        followUps: 0,
        resumetarget: 0,
        collegeTarget: 0,
        interviewsTarget: 0,
        resumesReceivedTarget: 0,
        interviewConductedTarget: 0,
      });
    }

    // Fetch existing targets
    const existingTargets = await model.MyTarget.findAll({
      where: {
        teamManagerId,
        targetDate: { [Op.between]: [sDate, eDate] },
      },
    });

    // Merge existing into date list
    const merged = dateList.map((d) => {
      const found = existingTargets.find((t) => {
        const tDate = new Date(t.targetDate);
        const tDateStr = tDate.toLocaleDateString("en-CA");
        return tDateStr === d.date;
      });
      return {
        ...d,
        jds: found ? found.jds : d.jds,
        calls: found ? found.calls : d.calls,
        followUps: found ? found.followUps : d.followUps,
        resumetarget: found ? found.resumetarget : d.resumetarget,
        collegeTarget: found ? found.collegeTarget : d.collegeTarget,
        interviewsTarget: found ? found.interviewsTarget : d.interviewsTarget,
        resumesReceivedTarget: found ? found.resumesReceivedTarget : d.resumesReceivedTarget,
        interviewConductedTarget: found ? found.interviewConductedTarget : d.interviewConductedTarget,
      };
    });

    // Totals
    const totals = {
      jds: merged.reduce((sum, t) => sum + t.jds, 0),
      calls: merged.reduce((sum, t) => sum + t.calls, 0),
      followUps: merged.reduce((sum, t) => sum + t.followUps, 0),
      resumetarget: merged.reduce((sum, t) => sum + t.resumetarget, 0),
      collegeTarget: merged.reduce((sum, t) => sum + t.collegeTarget, 0),
      interviewsTarget: merged.reduce((sum, t) => sum + t.interviewsTarget, 0),
      resumesReceivedTarget: merged.reduce((sum, t) => sum + t.resumesReceivedTarget, 0),
      interviewConductedTarget: merged.reduce((sum, t) => sum + t.interviewConductedTarget, 0),
    };

    return ReS(res, { success: true, dates: merged, totals }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchTargets = fetchTargets;
