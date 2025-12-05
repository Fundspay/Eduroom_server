"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

// Daily Analysis for ALL CoSheet records by teamManagerId
const getDailyAnalysis = async (req, res) => {
  try {
    const { teamManagerId, startDate, endDate, month } = req.query;
    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

    const today = new Date();
    let sDate, eDate;

    if (month) {
      const [year, mon] = month.split("-");
      sDate = new Date(year, mon - 1, 1);
      sDate.setHours(0, 0, 0, 0);
      eDate = new Date(year, mon, 0);
      eDate.setHours(23, 59, 59, 999);
    } else if (startDate && endDate) {
      sDate = new Date(startDate);
      sDate.setHours(0, 0, 0, 0);
      eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
    } else {
      sDate = new Date(today);
      sDate.setHours(0, 0, 0, 0);
      eDate = new Date(today);
      eDate.setHours(23, 59, 59, 999);
    }

    // Helper: Convert UTC DB date to IST string YYYY-MM-DD
    const toISTDateString = (utcDate) => {
      const date = new Date(utcDate);
      const istDate = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
      return istDate.toISOString().split("T")[0];
    };

    const dateList = [];
    for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
      dateList.push({
        date: d.toISOString().split("T")[0],
        day: d.toLocaleDateString("en-IN", { weekday: "long" }),
        plannedJds: 0,
        plannedCalls: 0,
        connected: 0,
        notAnswered: 0,
        busy: 0,
        switchOff: 0,
        invalid: 0,
        achievedCalls: 0,
        achievementPercent: 0,
        jdSent: 0,
        jdAchievementPercent: 0
      });
    }

    const targets = await model.MyTarget.findAll({
      where: {
        teamManagerId,
        targetDate: { [Op.between]: [sDate, eDate] }
      }
    });

    const allRecords = await model.CoSheet.findAll({
      where: {
        teamManagerId,
        [Op.or]: [
          { dateOfConnect: { [Op.between]: [sDate, eDate] } },
          { jdSentAt: { [Op.between]: [sDate, eDate] } }
        ]
      }
    });

    const allowedCallResponses = ["connected", "not answered", "busy", "switch off", "invalid"];

    const merged = dateList.map(d => {
      const target = targets.find(
        t => t.targetDate && toISTDateString(t.targetDate) === d.date
      );
      if (target) {
        d.plannedJds = target.jds;
        d.plannedCalls = target.calls;
      }

      const dayRecords = allRecords.filter(r => {
        const connectDate = r.dateOfConnect ? toISTDateString(r.dateOfConnect) : null;
        const jdDate = r.jdSentAt ? toISTDateString(r.jdSentAt) : null;
        return connectDate === d.date || jdDate === d.date;
      });

      dayRecords.forEach(r => {
        if (r.dateOfConnect) {
          const resp = (r.callResponse || "").trim().toLowerCase();
          if (allowedCallResponses.includes(resp)) {
            if (resp === "connected") d.connected++;
            else if (resp === "not answered") d.notAnswered++;
            else if (resp === "busy") d.busy++;
            else if (resp === "switch off") d.switchOff++;
            else if (resp === "invalid") d.invalid++;
          }
        }
      });

      d.achievedCalls = d.connected + d.notAnswered + d.busy + d.switchOff + d.invalid;
      d.achievementPercent =
        d.plannedCalls > 0 ? ((d.achievedCalls / d.plannedCalls) * 100).toFixed(2) : 0;

      const jdCount = dayRecords.filter(r => r.jdSentAt && toISTDateString(r.jdSentAt) === d.date).length;
      d.jdSent = jdCount;
      d.jdAchievementPercent =
        d.plannedJds > 0 ? ((d.jdSent / d.plannedJds) * 100).toFixed(2) : 0;

      return d;
    });

    const totals = merged.reduce(
      (sum, d) => {
        sum.plannedJds += d.plannedJds;
        sum.plannedCalls += d.plannedCalls;
        sum.connected += d.connected;
        sum.notAnswered += d.notAnswered;
        sum.busy += d.busy;
        sum.switchOff += d.switchOff;
        sum.invalid += d.invalid;
        sum.achievedCalls += d.achievedCalls;
        sum.jdSent += d.jdSent;
        return sum;
      },
      { plannedJds: 0, plannedCalls: 0, connected: 0, notAnswered: 0, busy: 0, switchOff: 0, invalid: 0, achievedCalls: 0, jdSent: 0 }
    );

    totals.achievementPercent =
      totals.plannedCalls > 0 ? ((totals.achievedCalls / totals.plannedCalls) * 100).toFixed(2) : 0;
    totals.jdAchievementPercent =
      totals.plannedJds > 0 ? ((totals.jdSent / totals.plannedJds) * 100).toFixed(2) : 0;

    const monthLabel = new Date(sDate).toLocaleString("en-IN", { month: "long", year: "numeric" });

    return ReS(
      res,
      {
        success: true,
        month: monthLabel,
        dates: merged,
        totals
      },
      200
    );
  } catch (error) {
    console.error("Daily Analysis Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getDailyAnalysis = getDailyAnalysis;



// Get all connected CoSheet records for a teamManager
const getConnectedCoSheetsByManager = async (req, res) => {
  try {
    const teamManagerId = req.params.teamManagerId;
    let { fromDate, toDate } = req.query;
    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

    const now = new Date();
    if (!fromDate || !toDate) {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const formatLocalDate = date =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
          date.getDate()
        ).padStart(2, "0")}`;
      fromDate = formatLocalDate(firstDay);
      toDate = formatLocalDate(lastDay);
    }

    const records = await model.CoSheet.findAll({
      where: {
        teamManagerId,
        callResponse: { [Op.iLike]: "connected" },
        dateOfConnect: { [Op.between]: [new Date(fromDate), new Date(toDate)] }
      },
      attributes: [
        "id",
        "sr",
        "collegeName",
        "coordinatorName",
        "mobileNumber",
        "emailId",
        "city",
        "state",
        "course",
        "connectedBy",
        "dateOfConnect",
        "callResponse",
        "internshipType",
        "detailedResponse",
        "jdSentAt",
        "followUpBy",
        "followUpDate",
        "followUpResponse",
        "resumeDate",
        "resumeCount",
        "teamManagerId",
        "isActive",
        "createdAt",
        "updatedAt"
      ],
      order: [["dateOfConnect", "ASC"]]
    });

    return ReS(res, { success: true, total: records.length, data: records }, 200);
  } catch (error) {
    console.error("Get Connected CoSheets Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getConnectedCoSheetsByManager = getConnectedCoSheetsByManager;

// Update CoSheet record
const updateConnectedCoSheet = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    if (!id) return ReE(res, "CoSheet id is required", 400);

    const [updatedRows] = await model.CoSheet.update(updateData, { where: { id } });
    if (updatedRows === 0) return ReE(res, "No record found to update", 404);

    return ReS(res, { success: true, message: "Record updated successfully" }, 200);
  } catch (error) {
    console.error("Update Connected CoSheet Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.updateConnectedCoSheet = updateConnectedCoSheet;

// Get CoSheet records + Call Response Counts
const getCoSheetsWithCounts = async (req, res) => {
  try {
    const { teamManagerId } = req.params;
    let { fromDate, toDate } = req.query;
    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

    const today = new Date();
    const formatLocalDate = date =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;

    if (!fromDate && !toDate) {
      fromDate = formatLocalDate(today);
      toDate = formatLocalDate(today);
    }
    if (fromDate && !toDate) toDate = fromDate;
    if (!fromDate && toDate) fromDate = toDate;

    const from = new Date(`${fromDate}T00:00:00.000Z`);
    const to = new Date(`${toDate}T23:59:59.999Z`);

    const data = await model.CoSheet.findAll({
      where: {
        teamManagerId,
        dateOfConnect: { [Op.between]: [from, to] }
      },
      order: [["dateOfConnect", "ASC"]]
    });

    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email", "mobileNumber"],
      order: [["name", "ASC"]]
    });

    const counts = {
      connected: { count: 0, records: [] },
      notAnswered: { count: 0, records: [] },
      busy: { count: 0, records: [] },
      switchOff: { count: 0, records: [] },
      invalid: { count: 0, records: [] }
    };

    data.forEach(r => {
      const resp = (r.callResponse || "").trim().toLowerCase();
      if (resp === "connected") {
        counts.connected.count++;
        counts.connected.records.push(r);
      } else if (resp === "not answered") {
        counts.notAnswered.count++;
        counts.notAnswered.records.push(r);
      } else if (resp === "busy") {
        counts.busy.count++;
        counts.busy.records.push(r);
      } else if (resp === "switch off") {
        counts.switchOff.count++;
        counts.switchOff.records.push(r);
      } else if (resp === "invalid") {
        counts.invalid.count++;
        counts.invalid.records.push(r);
      }
    });

    return ReS(res, { success: true, teamManagerId, fromDate, toDate, counts, managers }, 200);
  } catch (error) {
    console.error("Get CoSheet Records With Counts Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getCoSheetsWithCounts = getCoSheetsWithCounts;
