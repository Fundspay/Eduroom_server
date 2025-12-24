"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, fn, col } = model.Sequelize;
const moment = require("moment");
const { sendhrMail } = require("../middleware/mailerhr.middleware.js");



const updateResumeFields = async (req, res) => {
  try {
    const record = await model.CoSheet.findByPk(req.params.id);
    if (!record) return ReE(res, "CoSheet record not found", 404);

    const resumeFields = [
      "followUpBy",
      "followUpDate",
      "followUpResponse",
      "resumeDate",
      "resumeCount",
      "expectedResponseDate",
      "teamManagerId"
    ];

    const allowedFollowUpResponses = [
      "resumes received",
      "sending in 1-2 days",
      "delayed",
      "no response",
      "unprofessional",
    ];

    const updates = {};

    for (let f of resumeFields) {
      if (req.body[f] !== undefined) {
        if (f === "followUpResponse") {
          const val = req.body[f]?.toLowerCase();
          if (val && !allowedFollowUpResponses.includes(val)) {
            return ReE(
              res,
              "Invalid followUpResponse. Allowed: resumes received, sending in 1-2 days, delayed, no response, unprofessional",
              400
            );
          }
          updates[f] = val || null;
        } else {
          updates[f] = req.body[f];
        }
      }
    }

    if (!Object.keys(updates).length) {
      return ReE(res, "No resume fields to update", 400);
    }

    await record.update(updates);
    return ReS(res, { success: true, data: record }, 200);

  } catch (error) {
    console.error("CoSheet Resume Update Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.updateResumeFields = updateResumeFields;

const getResumeAnalysis = async (req, res) => {
  try {
    const teamManagerId = req.query.teamManagerId || req.params.teamManagerId;
    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

    const manager = await model.TeamManager.findOne({
      attributes: ["id", "name"],
      where: { id: teamManagerId },
      raw: true,
    });

    if (!manager) return ReE(res, "Invalid teamManagerId", 400);

    const managerName = manager.name;
    const { fromDate, toDate } = req.query;

    /* =======================
       DATE RANGE (COMMON)
    ======================= */
    const dateRange = {};
    if (fromDate) {
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      dateRange[Op.gte] = start;
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      dateRange[Op.lte] = end;
    }

    /* =======================
       FOLLOW-UPS (BY followUpDate)
    ======================= */
    const followUps = await model.CoSheet.findAll({
      where: {
        followUpBy: managerName,
        followUpResponse: {
          [Op.in]: [
            "sending in 1-2 days",
            "delayed",
            "no response",
            "unprofessional",
          ],
        },
        followUpDate: Object.keys(dateRange).length
          ? dateRange
          : {
              [Op.between]: [
                new Date(new Date().setHours(0, 0, 0, 0)),
                new Date(new Date().setHours(23, 59, 59, 999)),
              ],
            },
      },
      attributes: [
        "followUpResponse",
        [fn("COUNT", col("id")), "rowCount"],
      ],
      group: ["followUpResponse"],
      raw: true,
    });

    /* =======================
       RESUMES (BY resumeDate + response)
    ======================= */
    const resumes = await model.CoSheet.findAll({
      where: {
        followUpBy: managerName,
        followUpResponse: "resumes received",
        resumeDate: Object.keys(dateRange).length
          ? dateRange
          : {
              [Op.between]: [
                new Date(new Date().setHours(0, 0, 0, 0)),
                new Date(new Date().setHours(23, 59, 59, 999)),
              ],
            },
      },
      attributes: [[fn("SUM", col("resumeCount")), "resumeCount"]],
      raw: true,
    });

    /* =======================
       TARGETS (UNCHANGED)
    ======================= */
    let targetWhere = { teamManagerId };

    if (Object.keys(dateRange).length) {
      targetWhere.targetDate = dateRange;
    } else {
      targetWhere.targetDate = {
        [Op.between]: [
          new Date(new Date().setHours(0, 0, 0, 0)),
          new Date(new Date().setHours(23, 59, 59, 999)),
        ],
      };
    }

    const targets = await model.MyTarget.findAll({
      where: targetWhere,
      attributes: ["followUps", "resumetarget"],
      raw: true,
    });

    const totalFollowUpTarget = targets.reduce(
      (s, t) => s + (t.followUps || 0),
      0
    );

    const totalResumeTarget = targets.reduce(
      (s, t) => s + (t.resumetarget || 0),
      0
    );

    /* =======================
       CALCULATIONS
    ======================= */
    let totalAchievedFollowUps = 0;
    let totalAchievedResumes = Number(resumes[0]?.resumeCount || 0);

    const breakdown = {
      "sending in 1-2 days": 0,
      delayed: 0,
      "no response": 0,
      unprofessional: 0,
    };

    followUps.forEach((f) => {
      const response = f.followUpResponse.toLowerCase();
      const count = Number(f.rowCount || 0);

      totalAchievedFollowUps += count;

      if (breakdown.hasOwnProperty(response)) {
        breakdown[response] += count;
      }
    });

    const followUpEfficiency = totalFollowUpTarget
      ? ((totalAchievedFollowUps / totalFollowUpTarget) * 100).toFixed(2)
      : 0;

    const resumeEfficiency = totalResumeTarget
      ? ((totalAchievedResumes / totalResumeTarget) * 100).toFixed(2)
      : 0;

    return ReS(res, {
      success: true,
      analysis: [
        {
          teamManagerId,
          followUpBy: managerName,
          achievedResumes: totalAchievedResumes,
          achievedFollowUps: totalAchievedFollowUps,
          breakdown,
        },
      ],
      totals: {
        totalFollowUpTarget,
        totalAchievedFollowUps,
        followUpEfficiency: Number(followUpEfficiency),
        totalResumeTarget,
        totalAchievedResumes,
        resumeEfficiency: Number(resumeEfficiency),
        breakdownTotals: breakdown,
      },
    });
  } catch (error) {
    console.error("Resume Analysis Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getResumeAnalysis = getResumeAnalysis;


const gettotalResumeAnalysis = async (req, res) => {
  try {
    const { teamManagerId } = req.params;
    const { fromDate, toDate, period = "daily" } = req.query;
    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

    const now = new Date();
    const startDate = fromDate
      ? new Date(fromDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = toDate
      ? new Date(toDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const where = {
      teamManagerId,
      resumeDate: { [Op.between]: [startDate, endDate] },
    };

    const categories = ["resumes received", "sending in 1-2 days", "delayed", "no response", "unprofessional"];

    const data = await model.CoSheet.findAll({
      where,
      attributes: [
        [fn("DATE", col("resumeDate")), "resumeDay"],
        "followUpBy",
        "followUpResponse",
        [fn("SUM", col("resumeCount")), "resumeCount"]
      ],
      group: [fn("DATE", col("resumeDate")), "followUpBy", "followUpResponse"],
      order: [[fn("DATE", col("resumeDate")), "ASC"]],
      raw: true,
    });

    let periods = [];
    if (period === "daily") {
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        periods.push(new Date(d).toISOString().slice(0, 10));
      }
    } else {
      const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      for (let m = new Date(startMonth); m <= endMonth; m.setMonth(m.getMonth() + 1)) {
        periods.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
      }
    }

    const breakdown = periods.map(p => {
      let obj = { period: p, totalResumes: 0, followUpBy: null };
      categories.forEach(c => obj[c.replace(/\s/g, "_")] = 0);
      return obj;
    });

    data.forEach(d => {
      const periodKey = period === "daily" ? d.resumeDay : d.resumeDay.slice(0, 7);
      const index = breakdown.findIndex(b => b.period === periodKey);
      if (index !== -1) {
        const catKey = d.followUpResponse?.replace(/\s/g, "_");
        if (catKey) breakdown[index][catKey] += Number(d.resumeCount);
        breakdown[index].totalResumes += Number(d.resumeCount);
        if (d.followUpBy) breakdown[index].followUpBy = d.followUpBy;
      }
    });

    const total = { totalResumes: 0 };
    categories.forEach(c => total[c.replace(/\s/g, "_")] = 0);
    breakdown.forEach(b => {
      total.totalResumes += b.totalResumes;
      categories.forEach(c => total[c.replace(/\s/g, "_")] += b[c.replace(/\s/g, "_")]);
    });

    return ReS(res, { success: true, breakdown, total }, 200);

  } catch (error) {
    console.error("Resume Daily/Monthly Analysis Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.gettotalResumeAnalysis = gettotalResumeAnalysis;

// --- getResumeAnalysisPerCoSheet ---
function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const getResumeAnalysisPerCoSheet = async (req, res) => {
  try {
    const { teamManagerId } = req.params;
    const { fromDate, toDate } = req.query;

    const now = new Date();
    const startDate = fromDate
      ? new Date(fromDate)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = toDate
      ? new Date(toDate)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let periods = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      periods.push(formatLocalDate(new Date(d)));
    }

    const whereClause = {
      resumeDate: { [Op.between]: [startDate, endDate] },
    };
    if (teamManagerId) whereClause.teamManagerId = teamManagerId;

    const data = await model.CoSheet.findAll({
      where: whereClause,
      attributes: [
        [fn("DATE", col("resumeDate")), "resumeDay"],
        [fn("SUM", col("resumeCount")), "resumeCount"],
      ],
      group: ["resumeDay"],
      raw: true,
    });

    const resumeMap = {};
    data.forEach((d) => {
      const key = formatLocalDate(new Date(d.resumeDay));
      resumeMap[key] = Number(d.resumeCount);
    });

    const targetWhere = {
      targetDate: { [Op.between]: [startDate, endDate] },
    };
    if (teamManagerId) targetWhere.teamManagerId = teamManagerId;

    const targets = await model.MyTarget.findAll({
      where: targetWhere,
      attributes: ["targetDate", "resumetarget"],
      raw: true,
    });

    const targetMap = {};
    targets.forEach((t) => {
      const key = formatLocalDate(new Date(t.targetDate));
      targetMap[key] = t.resumetarget;
    });

    const result = periods.map((p) => {
      const totalResumes = resumeMap[p] || 0;
      const totalTarget = targetMap[p] || 0;
      const efficiency = totalTarget
        ? ((totalResumes / totalTarget) * 100).toFixed(2)
        : 0;

      return {
        period: p,
        resumes_recieved: totalResumes,
        resumetarget: totalTarget,
        efficiency: Number(efficiency),
      };
    });

    return ReS(res, { success: true, analysis: result }, 200);
  } catch (error) {
    console.error("Resume Analysis Per CoSheet Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getResumeAnalysisPerCoSheet = getResumeAnalysisPerCoSheet;

// 🔹 Endpoint: Get Resume Totals Per FollowUpBy (global, all users)
const getFollowUpResumeTotals = async (req, res) => {
  try {
    const { fromDate, toDate, period = "daily" } = req.query;

    const now = new Date();
    const startDate = fromDate
      ? new Date(fromDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = toDate
      ? new Date(toDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const where = {
      resumeDate: { [Op.between]: [startDate, endDate] },
    };

    const data = await model.CoSheet.findAll({
      where,
      attributes: [
        "followUpBy",
        [fn("DATE", col("resumeDate")), "resumeDay"],
        [fn("SUM", col("resumeCount")), "resumeCount"],
      ],
      group: ["followUpBy", fn("DATE", col("resumeDate"))],
      order: [[fn("DATE", col("resumeDate")), "ASC"]],
      raw: true,
    });

    if (!data.length) return ReS(res, { success: true, analysis: [] }, 200);

    const grouped = {};
    data.forEach((d) => {
      const followUp = d.followUpBy || "Unknown";
      const periodKey = period === "daily" ? d.resumeDay : d.resumeDay.slice(0, 7);

      if (!grouped[followUp]) {
        grouped[followUp] = { followUpBy: followUp, breakdown: {}, totalResumes: 0 };
      }
      if (!grouped[followUp].breakdown[periodKey]) {
        grouped[followUp].breakdown[periodKey] = 0;
      }

      grouped[followUp].breakdown[periodKey] += Number(d.resumeCount);
      grouped[followUp].totalResumes += Number(d.resumeCount);
    });

    const analysis = Object.values(grouped);

    return ReS(res, { success: true, analysis }, 200);

  } catch (error) {
    console.error("FollowUp Resume Totals Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getFollowUpResumeTotals = getFollowUpResumeTotals;

// ================================
// Get all CoSheet data by followUpBy teamManager
// ================================
const getFollowUpData = async (req, res) => {
  try {
    const teamManagerId = req.query.teamManagerId || req.params.teamManagerId;
    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

    const manager = await model.TeamManager.findOne({
      where: { id: teamManagerId },
      attributes: ["name","email","mobileNumber"],
      raw: true,
    });

    if (!manager) return ReE(res, "Manager not found", 404);

    const fullName = manager.name.trim();

    const coSheetData = await model.CoSheet.findAll({
      where: {
        teamManagerId,
        [Op.or]: [
          { followUpBy: { [Op.iLike]: fullName } },
          { followUpBy: { [Op.iLike]: fullName } },
        ],
      },
      order: [["resumeDate", "ASC"]],
      raw: true,
    });

    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email", "mobileNumber"],
      raw: true,
    });

    const userList = managers.map((TeamManager) => ({
      id: TeamManager.id,
      name: TeamManager.name,
      email: TeamManager.email,
      mobileNumber: TeamManager.mobileNumber,
    }));
   

    return ReS(res, {
      success: true,
      teamManagerId,
      followUpBy: fullName,
      totalRecords: coSheetData.length,
      data: coSheetData,
      managers: userList,
    });
  } catch (error) {
    console.error("Get FollowUp Data Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getFollowUpData = getFollowUpData;

// Generic function to fetch category rows
const fetchCategoryData = async (req, res, category) => {
  try {
    const teamManagerId = req.query.teamManagerId || req.params.teamManagerId;
    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

    // Get manager name based on ID so we can match followUpBy
    const manager = await model.TeamManager.findOne({
      attributes: ["id", "name", "email"],
      where: { id: teamManagerId },
      raw: true,
    });

    if (!manager) return ReE(res, "Invalid teamManagerId", 400);

    const managerName = manager.name;  // this will match followUpBy

    // Exact count from DB (updated to use followUpBy)
    const totalRecords = await model.CoSheet.count({
      where: {
        followUpBy: managerName,
        followUpResponse: category,
      },
    });

    // Fetch rows normally (unchanged but updated filter)
    const rows = await model.CoSheet.findAll({
      where: {
        followUpBy: managerName,
        followUpResponse: category,
      },
      raw: true,
    });

    // Return only this manager (unchanged)
    const userList = [
      {
        id: manager.id,
        name: manager.name,
        email: manager.email,
      },
    ];

    return ReS(res, {
      success: true,
      teamManagerId,
      category,
      totalRecords,
      data: rows,
      managers: userList,
    });
  } catch (error) {
    console.error(`Fetch ${category} Error:`, error);
    return ReE(res, error.message, 500);
  }
};

const getResumesReceived = (req, res) =>
  fetchCategoryData(req, res, "resumes received");
module.exports.getResumesReceived = getResumesReceived;




const getSendingIn12Days = (req, res) =>
  fetchCategoryData(req, res, "sending in 1-2 days");
module.exports.getSendingIn12Days = getSendingIn12Days;

const getDelayed = (req, res) => fetchCategoryData(req, res, "delayed");
module.exports.getDelayed = getDelayed;

const getNoResponse = (req, res) => fetchCategoryData(req, res, "no response");
module.exports.getNoResponse = getNoResponse;

const getUnprofessional = (req, res) =>
  fetchCategoryData(req, res, "unprofessional");
module.exports.getUnprofessional = getUnprofessional;

const getAllPendingFollowUps = async (req, res) => {
  try {
    const responseCategories = [
      "sending in 1-2 days",
      "delayed",
      "no response",
      "unprofessional",
    ];

    const coSheetData = await model.CoSheet.findAll({
      where: {
        followUpResponse: { [Op.in]: responseCategories },
      },
      order: [["resumeDate", "ASC"]],
      raw: true,
    });

    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email"],
      raw: true,
    });

    return ReS(res, {
      success: true,
      totalRecords: coSheetData.length,
      data: coSheetData,
      managers: managers,
    });
  } catch (error) {
    console.error("Get All Pending FollowUps Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getAllPendingFollowUps = getAllPendingFollowUps;

const sendFollowUpEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { cc, bcc, body } = req.body;

    const record = await model.CoSheet.findByPk(id);
    if (!record) return ReE(res, "CoSheet record not found", 404);

    if (!record.emailId) {
      return ReE(res, "No email found for this college", 400);
    }

    const subject = `Reconfirmation of Live Project Process – FundsAudit`;

    const html = `
      <p>Respected ${record.coordinatorName || "Sir/Mam"},</p>

      <p>Greetings from FundsAudit!</p>

      <p>I hope this message finds you well.</p>

      ${body}

      <p>Looking forward to a fruitful collaboration.</p>

      <p>Pooja M. Shedge<br/>
      Branch Manager – Pune<br/>
      +91 8421034535 | +91 7420861507<br/>
      Pune, Maharashtra<br/>
      <a href="https://www.fundsaudit.in/">https://www.fundsaudit.in/</a><br/>
      <a href="https://www.fundsweb.in/sub_sectors/subsector">https://www.fundsweb.in/sub_sectors/subsector</a>
      </p>
    `;

    const mailResponse = await sendhrMail(
      record.emailId,
      subject,
      html,
      [],
      cc,
      bcc
    );

    if (!mailResponse.success) {
      return ReE(res, "Failed to send follow-up email", 500);
    }

    await record.update({
      followupemailsent: true
    });

    return ReS(res, { success: true, message: "Follow-up email sent successfully" }, 200);
  } catch (error) {
    console.error("Send FollowUp Email Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.sendFollowUpEmail = sendFollowUpEmail;

