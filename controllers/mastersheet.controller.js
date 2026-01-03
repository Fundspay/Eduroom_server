"use strict";
const { ReE, ReS } = require("../utils/util.service.js");
const model = require("../models");
const { Op, fn, col } = require("sequelize");

var fetchMasterSheetTargets = async function (req, res) {
  try {
    let { teamManagerId, startDate, endDate, month } = req.query;

    const today = new Date();
    let sDate, eDate;

    // Determine date range
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

    // Set time to start/end of day
    sDate.setHours(0, 0, 0, 0);
    eDate.setHours(23, 59, 59, 999);

    let managers = [];
    let managerIdFilter = {};
    let managerNameFilter = null;

    if (teamManagerId) {
      teamManagerId = parseInt(teamManagerId, 10);

      const manager = await model.TeamManager.findOne({
        attributes: ["id", "name"],
        where: { id: teamManagerId },
        raw: true,
      });

      if (!manager) return ReE(res, "Invalid teamManagerId", 400);

      managers = [manager];
      managerIdFilter = { teamManagerId };
      managerNameFilter = manager.name.trim();
    } else {
      managers = await model.TeamManager.findAll({
        attributes: ["id", "name"],
        raw: true,
      });
    }

    //  Correct JD Sent count based on date range and team manager
    const jdSentCount = await model.CoSheet.count({
      where: {
        ...managerIdFilter,
        detailedResponse: "Send JD",
        dateOfConnect: { [Op.between]: [sDate, eDate] },
      },
    });

    const callResponseCount = await model.CoSheet.count({
      where: {
        ...(managerNameFilter ? { connectedBy: managerNameFilter } : {}),
        callResponse: { [Op.ne]: null },
        dateOfConnect: { [Op.between]: [sDate, eDate] },
      },
    });

    const resumeData = await model.CoSheet.findAll({
      where: {
        ...(managerNameFilter ? { followUpBy: managerNameFilter } : {}),
        followUpResponse: "resumes received",
        resumeDate: { [Op.between]: [sDate, eDate] },
      },
      attributes: [[fn("SUM", col("resumeCount")), "resumeCountSum"]],
      raw: true,
    });

    const resumeReceivedSum = Number(resumeData[0]?.resumeCountSum || 0);

    const resumes = await model.StudentResume.findAll({
      where: {
        ...(managerNameFilter ? { interviewedBy: managerNameFilter } : {}),
        [Op.or]: [
          { Dateofonboarding: { [Op.between]: [sDate, eDate] } },
          { Dateofonboarding: null, updatedAt: { [Op.between]: [sDate, eDate] } },
        ],
      },
      attributes: ["collegeName", "Dateofonboarding", "updatedAt"],
      raw: true,
    });

    const collegeSet = new Set();
    resumes.forEach((r) => r.collegeName && collegeSet.add(r.collegeName));

    const collegesAchieved = collegeSet.size;
    const resumesAchieved = resumes.length;

    const followUpsCount = await model.CoSheet.count({
      where: {
        ...(managerNameFilter ? { followUpBy: managerNameFilter } : {}),
        followUpResponse: {
          [Op.in]: [
            "sending in 1-2 days",
            "delayed",
            "no response",
            "unprofessional",
            "resumes received",
          ],
        },
        resumeDate: { [Op.between]: [sDate, eDate] },
      },
    });

    const resumeSelectedCount = await model.StudentResume.count({
      where: {
        ...(managerNameFilter ? { interviewedBy: managerNameFilter } : {}),
        finalSelectionStatus: "Selected",
        Dateofonboarding: { [Op.between]: [sDate, eDate] },
      },
    });

    //  Generate dates array correctly without timezone issues
    const formatDate = (date) => date.toISOString().split("T")[0];
    const dateList = [];
    for (let d = new Date(sDate.getTime()); d <= eDate; d.setDate(d.getDate() + 1)) {
      const current = new Date(d.getTime()); // clone
      dateList.push({
        date: formatDate(current),
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

    const existingTargets = await model.MyTarget.findAll({
      where: {
        ...managerIdFilter,
        targetDate: { [Op.between]: [sDate, eDate] },
      },
    });

    // Merge targets into dateList
    const merged = dateList.map((d) => {
      const matchedTargets = existingTargets.filter((t) => {
        const tDateStr = new Date(t.targetDate).toISOString().split("T")[0];
        return tDateStr === d.date;
      });

      return {
        ...d,
        jds: matchedTargets.reduce((s, t) => s + (t.jds || 0), 0),
        calls: matchedTargets.reduce((s, t) => s + (t.calls || 0), 0),
        followUps: matchedTargets.reduce((s, t) => s + (t.followUps || 0), 0),
        resumetarget: matchedTargets.reduce((s, t) => s + (t.resumetarget || 0), 0),
        collegeTarget: matchedTargets.reduce((s, t) => s + (t.collegeTarget || 0), 0),
        interviewsTarget: matchedTargets.reduce((s, t) => s + (t.interviewsTarget || 0), 0),
        resumesReceivedTarget: matchedTargets.reduce(
          (s, t) => s + (t.resumesReceivedTarget || 0),
          0
        ),
      };
    });

    const totals = {
      jds: merged.reduce((s, t) => s + t.jds, 0),
      calls: merged.reduce((s, t) => s + t.calls, 0),
      followUps: merged.reduce((s, t) => s + t.followUps, 0),
      resumetarget: merged.reduce((s, t) => s + t.resumetarget, 0),
      collegeTarget: merged.reduce((s, t) => s + t.collegeTarget, 0),
      interviewsTarget: merged.reduce((s, t) => s + t.interviewsTarget, 0),
      resumesReceivedTarget: merged.reduce((s, t) => s + t.resumesReceivedTarget, 0),
    };

    return ReS(
      res,
      {
        success: true,
        jdSentCount,
        callResponseCount,
        resumeReceivedSum,
        followUpsCount,
        resumeSelectedCount,
        collegesAchieved,
        resumesAchieved,
        managers,
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

    // Normalize date range
    sDate.setHours(0, 0, 0, 0);
    eDate.setHours(23, 59, 59, 999);

    // Fetch all managers
    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "mobileNumber"],
      raw: true,
    });

    const managerData = [];

    for (const manager of managers) {
      const managerName = manager.name.trim();
      const managerId = manager.id;

      const jdSentCount = await model.CoSheet.count({
  where: {
    ...(managerNameFilter ? { connectedBy: managerNameFilter } : {}),
    detailedResponse: "Send JD",
    dateOfConnect: { [Op.between]: [sDate, eDate] },
  },
});


      // ✅ Updated: Filter calls by connectedBy instead of teamManagerId
      const callResponseCount = await model.CoSheet.count({
        where: {
          connectedBy: managerName,
          callResponse: { [Op.ne]: null },
          dateOfConnect: { [Op.between]: [sDate, eDate] },
        },
      });

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

      const resumes = await model.StudentResume.findAll({
        where: {
          teamManagerId: managerId,
          resumeDate: { [Op.between]: [sDate, eDate] },
        },
        attributes: ["collegeName"],
        raw: true,
      });

      const collegeSet = new Set();
      resumes.forEach((r) => r.collegeName && collegeSet.add(r.collegeName));
      const collegesAchieved = collegeSet.size;

      const followUpsCount = await model.CoSheet.count({
        where: {
          teamManagerId: managerId,
          followUpResponse: "resumes received",
          resumeDate: { [Op.between]: [sDate, eDate] },
        },
      });

      const resumeSelectedCount = await model.StudentResume.count({
        where: {
          interviewedBy: managerName,
          finalSelectionStatus: "Selected",
          Dateofonboarding: { [Op.between]: [sDate, eDate] },
        },
      });

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

      const percentage = {
        jds: Number(target.jds) > 0 ? parseFloat(((jdSentCount / target.jds) * 100).toFixed(2)) : 0,
        calls: Number(target.calls) > 0 ? parseFloat(((callResponseCount / target.calls) * 100).toFixed(2)) : 0,
        followUps: Number(target.followUps) > 0 ? parseFloat(((followUpsCount / target.followUps) * 100).toFixed(2)) : 0,
        resumetarget: Number(target.resumetarget) > 0 ? parseFloat(((resumeReceivedSum / target.resumetarget) * 100).toFixed(2)) : 0,
        collegeTarget: Number(target.collegeTarget) > 0 ? parseFloat(((collegesAchieved / target.collegeTarget) * 100).toFixed(2)) : 0,
        resumesReceivedTarget: Number(target.resumesReceivedTarget) > 0
          ? parseFloat(((followUpsCount / target.resumesReceivedTarget) * 100).toFixed(2))
          : 0,
      };

      const rankScore = parseFloat(
        (
          (
            5 * percentage.jds +
            6 * percentage.calls +
            7 * percentage.followUps +
            8 * percentage.resumetarget +
            9 * percentage.collegeTarget +
            10 * percentage.resumesReceivedTarget
          ) / 6 * 100
        ).toFixed(2)
      ) || 0;

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
        rankScore,
      });
    }

    managerData.sort((a, b) => b.rankScore - a.rankScore);
    managerData.forEach((m, i) => {
      m.rank = i + 1;
    });

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







