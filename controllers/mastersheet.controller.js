"use strict";
const { ReE, ReS } = require("../utils/util.service.js");
const model = require("../models");
const { Op, fn, col } = require("sequelize");

var fetchMasterSheetTargets = async function (req, res) {
  try {
    let { teamManagerId, startDate, endDate, month } = req.query;

    const today = new Date();
    let sDate, eDate;

    // Month handling or default to current month
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

    // Normalize date range (remove time)
    sDate.setHours(0, 0, 0, 0);
    eDate.setHours(23, 59, 59, 999);

    let managerFilter = {};
    let managers = [];

    if (teamManagerId) {
      teamManagerId = parseInt(teamManagerId, 10);

      const manager = await model.TeamManager.findOne({
        attributes: ["id", "name"],
        where: { id: teamManagerId },
        raw: true,
      });

      if (!manager) return ReE(res, "Invalid teamManagerId", 400);

      managerFilter = { id: teamManagerId };
      managers = [manager];
    } else {
      managers = await model.TeamManager.findAll({
        attributes: ["id", "name"],
        raw: true,
      });
    }

    // JD sent count
    const jdSentCount = await model.CoSheet.count({
      where: {
        ...managerFilter,
        detailedResponse: "Send JD",
        dateOfConnect: { [Op.between]: [sDate, eDate] },
      },
    });

    // Call response count
    const callResponseCount = await model.CoSheet.count({
      where: {
        ...managerFilter,
        callResponse: { [Op.ne]: null },
        dateOfConnect: { [Op.between]: [sDate, eDate] },
      },
    });

    // Resume received sum
    const resumeData = await model.CoSheet.findAll({
      where: {
        ...managerFilter,
        followUpResponse: "resumes received",
        resumeDate: { [Op.between]: [sDate, eDate] },
      },
      attributes: [[fn("SUM", col("resumeCount")), "resumeCountSum"]],
      raw: true,
    });
    const resumeReceivedSum = Number(resumeData[0]?.resumeCountSum || 0);

    // ACTUAL COLLEGE COUNT
    const resumes = await model.StudentResume.findAll({
      where: {
        ...managerFilter,
        resumeDate: { [Op.between]: [sDate, eDate] },
      },
      attributes: ["collegeName", "followupBy"],
      raw: true,
    });

    const collegeSet = new Set();
    resumes.forEach((r) => {
      if (r.collegeName) collegeSet.add(r.collegeName);
    });
    const collegesAchieved = collegeSet.size;

    // FOLLOW-UPS COUNT (resumes received)
    const followUpsCount = await model.CoSheet.count({
      where: {
        ...managerFilter,
        followUpResponse: "resumes received",
        resumeDate: { [Op.between]: [sDate, eDate] },
      },
    });

    // RESUME SELECTED COUNT (filter by interviewDate, no time)
    const resumeSelectedCount = await model.StudentResume.count({
      where: {
        ...managerFilter,
        finalSelectionStatus: "Selected",
        interviewDate: { [Op.between]: [sDate, eDate] },
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
        ...managerFilter,
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
        resumesReceivedTarget: found ? found.resumesReceivedTarget : d.resumesReceivedTarget,
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
    };

    return ReS(res, {
      success: true,
      jdSentCount,
      callResponseCount,
      resumeReceivedSum,
      followUpsCount,
      resumeSelectedCount,
      collegesAchieved,
      managers,
      dates: merged,
      totals,
    }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchMasterSheetTargets = fetchMasterSheetTargets;

var fetchMasterSheetTargetsForAllManagers = async function (req, res) {
  try {
    let { startDate, endDate, month } = req.query;

    const today = new Date();
    let sDate, eDate;

    // Month handling or default to current month
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

    // Normalize date range (remove time)
    sDate.setHours(0, 0, 0, 0);
    eDate.setHours(23, 59, 59, 999);

    // Fetch all managers
    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "mobileNumber"],
      raw: true,
    });

    // Prepare results per manager
    const managerData = [];

    for (const manager of managers) {
      const managerName = manager.name.trim();
      const managerId = manager.id;

      // JD sent count
      const jdSentCount = await model.CoSheet.count({
        where: {
          teamManagerId: managerId,
          detailedResponse: "Send JD",
          dateOfConnect: { [Op.between]: [sDate, eDate] },
        },
      });

      // Call response count
      const callResponseCount = await model.CoSheet.count({
        where: {
          teamManagerId: managerId,
          callResponse: { [Op.ne]: null },
          dateOfConnect: { [Op.between]: [sDate, eDate] },
        },
      });

      // Resume received sum
      const resumeData = await model.CoSheet.findAll({
        where: {
          teamManagerId: managerId,
          followUpResponse: "resumes received",
          resumeDate: { [Op.between]: [sDate, eDate] },
        },
        attributes: [[fn("SUM", col("resumeCount")), "resumeCountSum"]],
        raw: true,
      });
      const resumeReceivedSum = Number(resumeData[0]?.resumeCountSum || 0);

      // ACTUAL COLLEGE COUNT
      const resumes = await model.StudentResume.findAll({
        where: {
          teamManagerId: managerId,
          resumeDate: { [Op.between]: [sDate, eDate] },
        },
        attributes: ["collegeName"],
        raw: true,
      });

      const collegeSet = new Set();
      resumes.forEach((r) => {
        if (r.collegeName) collegeSet.add(r.collegeName);
      });
      const collegesAchieved = collegeSet.size;

      // FOLLOW-UPS COUNT (resumes received)
      const followUpsCount = await model.CoSheet.count({
        where: {
          teamManagerId: managerId,
          followUpResponse: "resumes received",
          resumeDate: { [Op.between]: [sDate, eDate] },
        },
      });

      // RESUME SELECTED COUNT
      const resumeSelectedCount = await model.StudentResume.count({
        where: {
          interviewedBy: managerName,
          finalSelectionStatus: "Selected",
          interviewDate: { [Op.between]: [sDate, eDate] },
        },
      });

      // Fetch target for this manager
      const targetData = await model.MyTarget.findAll({
        where: {
          teamManagerId: managerId,
          targetDate: { [Op.between]: [sDate, eDate] },
        },
        attributes: [
          [fn("SUM", col("jds")), "jds"],
          [fn("SUM", col("calls")), "calls"],
          [fn("SUM", col("followUps")), "followUps"],
          [fn("SUM", col("resumetarget")), "resumetarget"],
          [fn("SUM", col("collegeTarget")), "collegeTarget"],
          [fn("SUM", col("interviewsTarget")), "interviewsTarget"],
          [fn("SUM", col("resumesReceivedTarget")), "resumesReceivedTarget"],
        ],
        raw: true,
      });

      const target = targetData[0] || {
        jds: 0,
        calls: 0,
        followUps: 0,
        resumetarget: 0,
        collegeTarget: 0,
        interviewsTarget: 0,
        resumesReceivedTarget: 0,
      };

      // Calculate percentages safely, rounded to 2 decimals
      const percentage = {
        jds: target.jds ? parseFloat(((jdSentCount / target.jds) * 100).toFixed(2)) : 0,
        calls: target.calls ? parseFloat(((callResponseCount / target.calls) * 100).toFixed(2)) : 0,
        followUps: target.followUps ? parseFloat(((followUpsCount / target.followUps) * 100).toFixed(2)) : 0,
        resumetarget: target.resumetarget ? parseFloat(((resumeReceivedSum / target.resumetarget) * 100).toFixed(2)) : 0,
        collegeTarget: target.collegeTarget ? parseFloat(((collegesAchieved / target.collegeTarget) * 100).toFixed(2)) : 0,
        interviewsTarget: target.interviewsTarget ? parseFloat(((resumeSelectedCount / target.interviewsTarget) * 100).toFixed(2)) : 0,
        resumesReceivedTarget: target.resumesReceivedTarget ? parseFloat(((followUpsCount / target.resumesReceivedTarget) * 100).toFixed(2)) : 0,
      };

      managerData.push({
        ...manager,
        jdSentCount,
        callResponseCount,
        resumeReceivedSum,
        followUpsCount,
        resumeSelectedCount,
        collegesAchieved,
        target,
        percentage,
      });
    }

    return ReS(res, {
      success: true,
      managers: managerData,
      startDate: sDate.toLocaleDateString("en-CA"),
      endDate: eDate.toLocaleDateString("en-CA"),
    }, 200);

  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchMasterSheetTargetsForAllManagers = fetchMasterSheetTargetsForAllManagers;




