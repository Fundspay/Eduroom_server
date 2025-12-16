"use strict";
const { ReE, ReS } = require("../utils/util.service.js");
const model = require("../models");
const { Op } = require("sequelize");

var fetchMasterSheetTargets = async function (req, res) {
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

    // 🔹 Count "Send JD" entries from CoSheet (date range applied)
    const jdSentCount = await model.CoSheet.count({
      where: {
        teamManagerId: teamManagerId,
        detailedResponse: "Send JD",
        dateOfConnect: {
          [Op.between]: [sDate, eDate],
        },
      },
    });

    // 🔹 Count callResponse (NOT NULL) entries from CoSheet (date range applied)
    const callResponseCount = await model.CoSheet.count({
      where: {
        teamManagerId: teamManagerId,
        callResponse: {
          [Op.ne]: null,
        },
        dateOfConnect: {
          [Op.between]: [sDate, eDate],
        },
      },
    });

    // 🔹 Sum resumeCount where followUpResponse = 'resume recieved'
    const resumeReceivedSum = await model.CoSheet.sum("resumeCount", {
      where: {
        teamManagerId: teamManagerId,
        followUpResponse: "Resumes Recieved",
        resumeDate: {
          [Op.between]: [sDate, eDate],
        },
      },
    });

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
        const tDateStr = new Date(t.targetDate).toLocaleDateString("en-CA");
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
        resumesReceivedTarget: found
          ? found.resumesReceivedTarget
          : d.resumesReceivedTarget,
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
      resumesReceivedTarget: merged.reduce(
        (sum, t) => sum + t.resumesReceivedTarget,
        0
      ),
    };

    return ReS(
      res,
      {
        success: true,
        jdSentCount,
        callResponseCount,
        resumeReceivedSum: resumeReceivedSum || 0,
        dates: merged,
        totals,
      },
      200
    );
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchMasterSheetTargets = fetchMasterSheetTargets;



