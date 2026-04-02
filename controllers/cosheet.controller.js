"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { sendhrMail } = require("../middleware/mailerhr.middleware.js");
const AWS = require("aws-sdk");
const { Op } = require("sequelize");
const axios = require("axios");
const FormData = require("form-data");


const SES_API_URL = "https://api.fundsweb.in/api/v1/sendemail/send-email";


// / configure S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Create / Upload CoSheet (Excel JSON)
const createCoSheet = async (req, res) => {
  try {
    const dataArray = Array.isArray(req.body) ? req.body : [req.body];
    if (!dataArray.length) return ReE(res, "No data provided", 400);

    const validDetails = [];

    const results = await Promise.all(
      dataArray.map(async (data, index) => {
        try {
          const payload = {
            // -------- College Details --------
            sr: data.collegeDetails?.sr ?? data.sr ?? null,
            collegeName: data.collegeDetails?.collegeName ?? data.collegeName ?? null,
            coordinatorName: data.collegeDetails?.coordinatorName ?? data.coordinatorName ?? null,
            mobileNumber: data.collegeDetails?.mobileNumber
              ? String(data.collegeDetails.mobileNumber)
              : data.mobileNumber
                ? String(data.mobileNumber)
                : null,
            emailId: data.collegeDetails?.emailId ?? data.emailId ?? null,
            city: data.collegeDetails?.city ?? data.city ?? null,
            state: data.collegeDetails?.state ?? data.state ?? null,
            course: data.collegeDetails?.course ?? data.course ?? null,

            // -------- MBA / Meta --------
            mbaFeeApprox:
              data.collegeDetails?.mbaFeeApprox ?? data.mbaFeeApprox ?? null,

            mbaBatchStrengthApprox:
              data.collegeDetails?.mbaBatchStrengthApprox ?? data.mbaBatchStrengthApprox ?? null,

            collegeTier:
              data.collegeDetails?.collegeTier ?? data.collegeTier ?? null,

            collegeLevel:
              data.collegeDetails?.collegeLevel ?? data.collegeLevel ?? null,

            comment:
              data.collegeDetails?.comment ?? data.comment ?? null,

            corporateRelations:
              data.collegeDetails?.corporateRelations ?? data.corporateRelations ?? null,

            // -------- Placement Cell (FIXED) --------
            placementCell:
              data.collegeDetails?.placementCell ?? data.placementCell ?? null,

            // -------- Connect Details --------
            dateOfConnect: data.connect?.dateOfConnect ?? data.dateOfConnect ?? null,
            callResponse: data.connect?.callResponse ?? data.callResponse ?? null,
            internshipType: data.connect?.internshipType ?? data.internshipType ?? null,
            detailedResponse: data.connect?.detailedResponse ?? data.detailedResponse ?? null,
            connectedBy: data.connect?.connectedBy ?? data.connectedBy ?? null,

            teamManagerId: data.teamManagerId ?? req.user?.id ?? null,
          };

          // ❗ Only check: skip completely empty rows (collegeName missing)
          if (!payload.collegeName) return null;

          const record = await model.CoSheet.create(payload);
          validDetails.push({
            row: index + 1,
            rowData: record,
          });

          return record;
        } catch (err) {
          console.error("Single CoSheet record create failed:", err);
          return null;
        }
      })
    );

    return ReS(
      res,
      {
        success: true,
        total: dataArray.length,
        created: validDetails.length,
        data: validDetails,
      },
      201
    );
  } catch (error) {
    console.error("CoSheet Create Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.createCoSheet = createCoSheet;

// Update connect fields
const updateConnectFields = async (req, res) => {
  try {
    const record = await model.CoSheet.findByPk(req.params.id);
    if (!record) return ReE(res, "CoSheet record not found", 404);

    const updates = {
      // -------- College Details --------
      sr: req.body.collegeDetails?.sr ?? req.body.sr,
      collegeName: req.body.collegeDetails?.collegeName ?? req.body.collegeName,
      coordinatorName: req.body.collegeDetails?.coordinatorName ?? req.body.coordinatorName,
      mobileNumber: req.body.collegeDetails?.mobileNumber ?? req.body.mobileNumber,
      emailId: req.body.collegeDetails?.emailId ?? req.body.emailId,
      city: req.body.collegeDetails?.city ?? req.body.city,
      state: req.body.collegeDetails?.state ?? req.body.state,
      course: req.body.collegeDetails?.course ?? req.body.course,

      // -------- MBA / Meta --------
      mbaFeeApprox:
        req.body.collegeDetails?.mbaFeeApprox ?? req.body.mbaFeeApprox,

      mbaBatchStrengthApprox:
        req.body.collegeDetails?.mbaBatchStrengthApprox ?? req.body.mbaBatchStrengthApprox,

      collegeTier:
        req.body.collegeDetails?.collegeTier ?? req.body.collegeTier,

      collegeLevel:
        req.body.collegeDetails?.collegeLevel ?? req.body.collegeLevel,

      comment:
        req.body.collegeDetails?.comment ?? req.body.comment,

      corporateRelations:
        req.body.collegeDetails?.corporateRelations ?? req.body.corporateRelations,

      // -------- Placement Cell (FIXED) --------
      placementCell:
        req.body.collegeDetails?.placementCell ?? req.body.placementCell ?? req.body.placemetCell,

      // -------- Connect Details --------
      connectedBy: req.body.connect?.connectedBy ?? req.body.connectedBy,
      dateOfConnect: req.body.connect?.dateOfConnect ?? req.body.dateOfConnect,
      callResponse: req.body.connect?.callResponse ?? req.body.callResponse,
      internshipType: req.body.connect?.internshipType ?? req.body.internshipType,
      detailedResponse: req.body.connect?.detailedResponse ?? req.body.detailedResponse,

      // -------- Follow-ups / Resume --------
      followUpBy: req.body.followUpBy,
      followUpDate: req.body.followUpDate,
      followUpResponse: req.body.followUpResponse,
      resumeDate: req.body.resumeDate,
      resumeCount: req.body.resumeCount,
      expectedResponseDate: req.body.expectedResponseDate,
      followupemailsent: req.body.followupemailsent,

      teamManagerId: req.body.teamManagerId,
    };

    await record.update(updates);
    return ReS(res, { success: true, data: record }, 200);
  } catch (error) {
    console.error("CoSheet Update Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.updateConnectFields = updateConnectFields;



// Get all CoSheets
const getCoSheets = async (req, res) => {
  try {
    const records = await model.CoSheet.findAll();
    const managers = await model.TeamManager.findAll({
      where: { isActive: true, isDeleted: false },
      attributes: ["id", "name", "email"],
      order: [["name", "ASC"]],
    });

    return ReS(res, { success: true, data: records, managers }, 200);
  } catch (error) {
    console.error("CoSheet Fetch All Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getCoSheets = getCoSheets;


// Get single CoSheet
const getCoSheetByManager = async (req, res) => {
  try {
    let { managerName } = req.params; // Frontend sends manager name

    if (!managerName) return ReE(res, "managerName is required", 400);

    managerName = managerName.trim().toLowerCase(); // Trim & lowercase for consistent matching

    // Fetch CoSheet records where connectedBy matches manager name and callResponse is "connected"
    const records = await model.CoSheet.findAll({
      where: {
        connectedBy: {
          [Op.iLike]: managerName // Case-insensitive match (works with PostgreSQL)
        },
        callResponse: {
          [Op.iLike]: "connected" // Case-insensitive "connected"
        }
      },
      order: [["dateOfConnect", "ASC"]] // Optional: order by date
    });

    // ---------------------------
    // Fetch all registered managers
    // ---------------------------
    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email", "mobileNumber"],
      order: [["name", "ASC"]]
    });

    return ReS(res, {
      success: true,
      count: records.length,
      data: records,
      managers,
      message: records.length
        ? `Found ${records.length} connected CoSheet records for manager ${managerName}`
        : "No connected CoSheet records found for this manager"
    }, 200);
  } catch (error) {
    console.error("CoSheet Fetch By Manager Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCoSheetByManager = getCoSheetByManager;

// Get single CoSheet filtered by manager and callResponse = "Not Answered"
const getCoSheetByManagerCNA = async (req, res) => {
  try {
    let { managerName } = req.params; // Frontend sends manager name
    let { fromDate, toDate } = req.query; // Optional date range

    if (!managerName) return ReE(res, "managerName is required", 400);

    managerName = managerName.trim().toLowerCase(); // Trim & lowercase for consistent matching

    // ---------------------------
    // Date handling (default = current month till today)
    // ---------------------------
    const today = new Date();
    let from, to;

    if (fromDate && toDate) {
      from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);

      to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
    } else {
      from = new Date(today.getFullYear(), today.getMonth(), 1); // first day of current month
      from.setHours(0, 0, 0, 0);

      to = new Date(today);
      to.setHours(23, 59, 59, 999);
    }

    // ---------------------------
    // Fetch CoSheet records
    // ---------------------------
    const records = await model.CoSheet.findAll({
      where: {
        connectedBy: { [Op.iLike]: managerName }, // Case-insensitive match
        callResponse: { [Op.iLike]: "Not Answered" }, // Case-insensitive
        dateOfConnect: { [Op.between]: [from, to] } // Date range filter
      },
      order: [["dateOfConnect", "ASC"]]
    });

    // ---------------------------
    // Fetch all registered managers
    // ---------------------------
    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email", "mobileNumber"],
      order: [["name", "ASC"]]
    });

    return ReS(res, {
      success: true,
      count: records.length,
      data: records,
      managers, // All registered managers
      message: records.length
        ? `Found ${records.length} "Not Answered" CoSheet records for manager ${managerName} between ${from.toISOString().split("T")[0]} and ${to.toISOString().split("T")[0]}`
        : "No 'Not Answered' CoSheet records found for this manager in the given date range"
    }, 200);

  } catch (error) {
    console.error("CoSheet Fetch By Manager Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCoSheetByManagerCNA = getCoSheetByManagerCNA;


// Get single CoSheet filtered by manager and callResponse = "Busy"
const getCoSheetByManagerBusy = async (req, res) => {
  try {
    let { managerName } = req.params; // Frontend sends manager name
    let { fromDate, toDate } = req.query; // Optional date range

    if (!managerName) return ReE(res, "managerName is required", 400);

    managerName = managerName.trim().toLowerCase(); // Trim & lowercase for consistent matching

    // ---------------------------
    // Date handling (default = current month till today)
    // ---------------------------
    const today = new Date();
    let from, to;

    if (fromDate && toDate) {
      from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);

      to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
    } else {
      from = new Date(today.getFullYear(), today.getMonth(), 1); // first day of current month
      from.setHours(0, 0, 0, 0);

      to = new Date(today);
      to.setHours(23, 59, 59, 999);
    }

    // ---------------------------
    // Fetch CoSheet records
    // ---------------------------
    const records = await model.CoSheet.findAll({
      where: {
        connectedBy: { [Op.iLike]: managerName }, // Case-insensitive match
        callResponse: { [Op.iLike]: "Busy" }, // Case-insensitive
        dateOfConnect: { [Op.between]: [from, to] } // Date range filter
      },
      order: [["dateOfConnect", "ASC"]] // Optional: order by date
    });

    // ---------------------------
    // Format local date for message
    // ---------------------------
    const formatLocalDate = (date) => {
      const d = new Date(date);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    // ---------------------------
    // Fetch all registered managers
    // ---------------------------
    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email", "mobileNumber"],
      order: [["name", "ASC"]]
    });

    return ReS(res, {
      success: true,
      count: records.length,
      data: records,
      managers,
      message: records.length
        ? `Found ${records.length} "Busy" CoSheet records for manager ${managerName} between ${formatLocalDate(from)} and ${formatLocalDate(to)}`
        : "No 'Not Answered' CoSheet records found for this manager in the given date range"
    }, 200);

  } catch (error) {
    console.error("CoSheet Fetch By Manager Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCoSheetByManagerBusy = getCoSheetByManagerBusy;

// Get single CoSheet filtered by manager and callResponse = "Busy"
const getCoSheetByManagerSwitchoff = async (req, res) => {
  try {
    let { managerName } = req.params; // Frontend sends manager name
    let { fromDate, toDate } = req.query; // Optional date range

    if (!managerName) return ReE(res, "managerName is required", 400);

    managerName = managerName.trim().toLowerCase(); // Trim & lowercase for consistent matching

    // ---------------------------
    // Date handling (default = current month till today)
    // ---------------------------
    const today = new Date();
    let from, to;

    if (fromDate && toDate) {
      from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);

      to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
    } else {
      from = new Date(today.getFullYear(), today.getMonth(), 1); // first day of current month
      from.setHours(0, 0, 0, 0);

      to = new Date(today);
      to.setHours(23, 59, 59, 999);
    }

    // ---------------------------
    // Fetch CoSheet records
    // ---------------------------
    const records = await model.CoSheet.findAll({
      where: {
        connectedBy: { [Op.iLike]: managerName }, // Case-insensitive match
        callResponse: { [Op.iLike]: "Switch Off" }, // Case-insensitive
        dateOfConnect: { [Op.between]: [from, to] } // Date range filter
      },
      order: [["dateOfConnect", "ASC"]] // Optional: order by date
    });

    // ---------------------------
    // Format local date for message
    // ---------------------------
    const formatLocalDate = (date) => {
      const d = new Date(date);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    // ---------------------------
    // Fetch all registered managers
    // ---------------------------
    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email", "mobileNumber"],
      order: [["name", "ASC"]]
    });

    return ReS(res, {
      success: true,
      count: records.length,
      data: records,
      managers,
      message: records.length
        ? `Found ${records.length} "Busy" CoSheet records for manager ${managerName} between ${formatLocalDate(from)} and ${formatLocalDate(to)}`
        : "No 'Not Answered' CoSheet records found for this manager in the given date range"
    }, 200);

  } catch (error) {
    console.error("CoSheet Fetch By Manager Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCoSheetByManagerSwitchoff = getCoSheetByManagerSwitchoff;

// Get single CoSheet filtered by manager and callResponse = "Busy"
const getCoSheetByManagerInvalid = async (req, res) => {
  try {
    let { managerName } = req.params; // Frontend sends manager name
    let { fromDate, toDate } = req.query; // Optional date range

    if (!managerName) return ReE(res, "managerName is required", 400);

    managerName = managerName.trim().toLowerCase(); // Trim & lowercase for consistent matching

    // ---------------------------
    // Date handling (default = current month till today)
    // ---------------------------
    const today = new Date();
    let from, to;

    if (fromDate && toDate) {
      from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);

      to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
    } else {
      from = new Date(today.getFullYear(), today.getMonth(), 1); // first day of current month
      from.setHours(0, 0, 0, 0);

      to = new Date(today);
      to.setHours(23, 59, 59, 999);
    }

    // ---------------------------
    // Fetch CoSheet records
    // ---------------------------
    const records = await model.CoSheet.findAll({
      where: {
        connectedBy: { [Op.iLike]: managerName }, // Case-insensitive match
        callResponse: { [Op.iLike]: "Invalid" }, // Case-insensitive
        dateOfConnect: { [Op.between]: [from, to] } // Date range filter
      },
      order: [["dateOfConnect", "ASC"]] // Optional: order by date
    });

    // ---------------------------
    // Format local date for message
    // ---------------------------
    const formatLocalDate = (date) => {
      const d = new Date(date);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    // ---------------------------
    // Fetch all registered managers
    // ---------------------------
    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email", "mobileNumber"],
      order: [["name", "ASC"]]
    });

    return ReS(res, {
      success: true,
      count: records.length,
      data: records,
      managers,
      message: records.length
        ? `Found ${records.length} "Busy" CoSheet records for manager ${managerName} between ${formatLocalDate(from)} and ${formatLocalDate(to)}`
        : "No 'Not Answered' CoSheet records found for this manager in the given date range"
    }, 200);

  } catch (error) {
    console.error("CoSheet Fetch By Manager Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCoSheetByManagerInvalid = getCoSheetByManagerInvalid

const sendJDToCollege = async (req, res) => {
  try {
    const { id } = req.params;
    const { cc, bcc, body, attachment, subject, userId, fromAddress } = req.body;

    if (!userId) return ReE(res, "userId is required", 400);
    if (!fromAddress) return ReE(res, "fromAddress is required", 400);

    // Step 1 — Fetch college record
    const record = await model.CoSheet.findByPk(id);
    if (!record) return ReE(res, "CoSheet record not found", 404);
    if (!record.emailId) return ReE(res, "No email found for this college", 400);

    // ✅ Safe conversions — handle arrays, nulls, undefined
    const toAddress = record.emailId;
    const ccStr = Array.isArray(cc) ? cc.join(", ") : (cc || "");
    const bccStr = Array.isArray(bcc) ? bcc.join(", ") : (bcc || "");
    const bodyStr = Array.isArray(body) ? body.join("") : (body || "");
    const subjectStr = Array.isArray(subject) ? subject.join("") : (subject || "");
    const userIdStr = Array.isArray(userId) ? userId[0] : String(userId);
    const fromAddressStr = Array.isArray(fromAddress) ? fromAddress[0] : String(fromAddress);

    // Step 2 — Build FormData
    const form = new FormData();

    form.append("toAddress", toAddress);
    form.append("fromAddress", fromAddressStr);
    form.append("userId", userIdStr);
    if (ccStr.trim().length > 0) form.append("cc", ccStr);
    if (bccStr.trim().length > 0) form.append("bcc", bccStr);

    const finalSubject =
      subjectStr.trim().length > 0
        ? subjectStr
        : `Collaboration Proposal – FundsAudit`;
    form.append("subject", finalSubject);

    // Step 3 — Build HTML body
    const html = `
      <p>Respected ${record.coordinatorName || "Sir/Madam"},</p>

      <p>Warm greetings from FundsAudit!</p>

      <p>We are reaching out with an exciting collaboration opportunity for your institute ${
        record.collegeName || ""
      }, aimed at enhancing student development through real-time industry exposure in the fintech space.</p>

      <p>Founded in 2020, FundsAudit is an ISO-certified, innovation-driven fintech startup, registered under the 
      Startup India initiative with 400,000 active customers. We are members of AMFI, SEBI, BSE, and NSE.</p>

      ${bodyStr}

      <p>Looking forward to a meaningful and mutually beneficial association.</p>

      <p>
        Pooja M. Shedge<br/>
        Branch Manager – Pune<br/>
        +91 7385234536 | +91 9322509539<br/>
        Pune, Maharashtra<br/>
        <a href="https://www.fundsaudit.in/">https://www.fundsaudit.in/</a><br/>
        <a href="https://www.fundsweb.in/sub_sectors/subsector">https://www.fundsweb.in/sub_sectors/subsector</a>
      </p>
    `;
    form.append("bodyText", html);

    // Step 4 — Attachments
    const attachmentArr = Array.isArray(attachment) ? attachment : [];

    if (attachmentArr.length > 0) {
      // Frontend provided attachments (base64)
      for (const a of attachmentArr) {
        if (a.content && a.filename) {
          const buffer = Buffer.from(a.content, "base64");
          form.append("file", buffer, {
            filename: a.filename,
            contentType: "application/pdf",
          });
        }
      }
    } else {
      // S3 fallback
      if (!record.internshipType) {
        return ReE(res, "No internshipType set for this record", 400);
      }

      const JD_MAP = {
        fulltime: "jds/fulltime.pdf",
        liveproject: "jds/liveproject.pdf",
        sip: "jds/sip.pdf",
        wip: "jds/wip.pdf",
        others: "jds/others.pdf",
      };

      const jdKeyType = record.internshipType
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
      const jdKey = JD_MAP[jdKeyType];

      if (!jdKey) {
        return ReE(res, `No JD mapped for internshipType: ${jdKeyType}`, 400);
      }

      const jdFile = await s3
        .getObject({ Bucket: "fundsroomhr", Key: jdKey })
        .promise();

      form.append("file", jdFile.Body, {
        filename: `${record.internshipType}.pdf`,
        contentType: "application/pdf",
      });
    }

    // Step 5 — Call Project A's SES endpoint
    const response = await axios.post(SES_API_URL, form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    if (!response.data || response.status !== 200) {
      console.error("SES API Error:", response.data);
      return ReE(res, "Failed to send JD email via SES", 500);
    }

    // Step 6 — Update record
    await record.update({ jdSentAt: new Date() });

    return ReS(
      res,
      {
        success: true,
        message: "JD sent successfully with proposal",
        messageId: response.data?.messageId,
      },
      200
    );
  } catch (error) {
    console.error("Send JD Error:", error?.response?.data || error.message);
    return ReE(res, error?.response?.data?.error || error.message, 500);
  }
};

module.exports.sendJDToCollege = sendJDToCollege;


const getCallStatsByUserWithTarget = async (req, res) => {
  try {
    const teamManagerId = req.params.userId;
    let { fromDate, toDate } = req.query;

    const now = new Date();

    if (!fromDate || !toDate) {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const formatLocalDate = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      fromDate = formatLocalDate(firstDay);
      toDate = formatLocalDate(lastDay);
    }

    const records = await model.CoSheet.findAll({
      where: {
        teamManagerId,
        dateOfConnect: { [Op.between]: [new Date(fromDate), new Date(toDate)] }
      }
    });

    const totalCalls = records.length;

    const targetRecord = await model.MyTarget.findOne({
      where: { teamManagerId }
    });

    const targetCalls = targetRecord ? targetRecord.calls : 0;
    const achievedCalls = totalCalls;
    const remainingCalls = Math.max(targetCalls - achievedCalls, 0);
    const achievementPercent = targetCalls > 0 ? ((achievedCalls / targetCalls) * 100).toFixed(2) : 0;

    const allowedCallResponses = ["connected", "not answered", "busy", "switch off", "invalid"];
    const stats = {};
    allowedCallResponses.forEach((resp) => { stats[resp] = 0; });
    records.forEach((rec) => {
      const response = (rec.callResponse || "").toLowerCase();
      if (allowedCallResponses.includes(response)) stats[response]++;
    });
    const percentages = {};
    allowedCallResponses.forEach((resp) => {
      percentages[resp] = ((stats[resp] / totalCalls) * 100).toFixed(2);
    });

    const monthLabel = new Date(fromDate).toLocaleString("en-IN", { month: "long", year: "numeric" });

    return ReS(res, {
      success: true,
      data: {
        month: monthLabel,
        fromDate,
        toDate,
        totalCalls,
        targetCalls,
        achievedCalls,
        remainingCalls,
        achievementPercent,
        counts: stats,
        percentages
      }
    }, 200);

  } catch (error) {
    console.error("Call Stats Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCallStatsByUserWithTarget = getCallStatsByUserWithTarget;

const getJdStatsWithTarget = async (req, res) => {
  try {
    const teamManagerId = req.params.userId;
    let { fromDate, toDate } = req.query;
    const now = new Date();

    if (!fromDate || !toDate) {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const formatLocalDate = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      fromDate = formatLocalDate(firstDay);
      toDate = formatLocalDate(lastDay);
    }

    const jdSentByUser = await model.CoSheet.count({
      where: {
        teamManagerId,
        jdSentAt: { [Op.between]: [new Date(fromDate), new Date(toDate)] }
      }
    });

    const jdSentByAllUsers = await model.CoSheet.count({
      where: {
        jdSentAt: { [Op.between]: [new Date(fromDate), new Date(toDate)] }
      }
    });

    const targetRecord = await model.MyTarget.findOne({ where: { teamManagerId } });
    const jdTarget = targetRecord ? targetRecord.jds : 0;
    const remainingJD = Math.max(jdTarget - jdSentByUser, 0);
    const achievementPercent = jdTarget > 0 ? ((jdSentByUser / jdTarget) * 100).toFixed(2) : 0;

    const monthLabel = new Date(fromDate).toLocaleString("en-US", { month: "long", year: "numeric" });

    return ReS(res, {
      success: true,
      data: {
        month: monthLabel,
        fromDate,
        toDate,
        jdTarget,
        jdSentByUser,
        remainingJD,
        achievementPercent,
        jdSentByAllUsers
      }
    }, 200);

  } catch (error) {
    console.error("JD Stats Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getJdStatsWithTarget = getJdStatsWithTarget;

const getInternshipStats = async (req, res) => {
  try {
    const teamManagerId = req.params.userId;
    let { fromDate, toDate } = req.query;
    const now = new Date();

    if (!fromDate || !toDate) {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const formatLocalDate = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      fromDate = formatLocalDate(firstDay);
      toDate = formatLocalDate(lastDay);
    }

    const allowedInternshipTypes = ["fulltime", "sip", "live project", "wip", "others"];

    const userCounts = {};
    for (const type of allowedInternshipTypes) {
      userCounts[type] = await model.CoSheet.count({
        where: {
          teamManagerId,
          internshipType: type,
          dateOfConnect: { [Op.between]: [new Date(fromDate), new Date(toDate)] }
        }
      });
    }

    const totalCounts = {};
    for (const type of allowedInternshipTypes) {
      totalCounts[type] = await model.CoSheet.count({
        where: {
          internshipType: type,
          dateOfConnect: { [Op.between]: [new Date(fromDate), new Date(toDate)] }
        }
      });
    }

    const monthLabel = new Date(fromDate).toLocaleString("en-US", { month: "long", year: "numeric" });

    return ReS(res, {
      success: true,
      data: {
        month: monthLabel,
        fromDate,
        toDate,
        internshipByUser: userCounts,
        internshipByAllUsers: totalCounts
      }
    }, 200);

  } catch (error) {
    console.error("Internship Stats Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getInternshipStats = getInternshipStats;



// ✅ Get InternshipType → College + Month Stats from detailedResponse (filter by current/requested month)
const getInternshipTypeColleges = async (req, res) => {
  try {
    const teamManagerId = req.query.userId; // optional
    let { fromDate, toDate } = req.query;

    const now = new Date();

    // ✅ Default to current month if no range provided
    if (!fromDate || !toDate) {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const formatDate = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      fromDate = formatDate(firstDay);
      toDate = formatDate(lastDay);
    }

    // ✅ Allowed months
    const allowedMonths = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december"
    ];

    // ✅ Current/requested month
    const currentMonth = new Date(fromDate).getMonth(); // 0-11
    const currentMonthName = allowedMonths[currentMonth];

    // ✅ Build where clause
    const whereClause = {
      dateOfConnect: {
        [Op.between]: [new Date(fromDate), new Date(toDate)],
      },
    };
    if (teamManagerId) whereClause.teamManagerId = teamManagerId;

    // ✅ Fetch records
    const records = await model.CoSheet.findAll({
      where: whereClause,
      attributes: ["internshipType", "collegeName", "detailedResponse", "jdSentAt"],
    });

    // ✅ Process each record
    const result = [];

    records.forEach((rec) => {
      const detailedResp = (rec.detailedResponse || "").toLowerCase();

      // Only include if the detailedResponse mentions the current/requested month
      if (!detailedResp.includes(currentMonthName)) return;

      result.push({
        collegeName: rec.collegeName || "Unknown",
        internshipType: (rec.internshipType || "others").toLowerCase(),
        monthMentioned: currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1),
        jdSent: rec.jdSentAt ? true : false,
      });
    });

    // ✅ Month label (for overall filter range)
    const monthLabel = new Date(fromDate).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });

    return ReS(
      res,
      {
        success: true,
        month: monthLabel,
        fromDate,
        toDate,
        data: result,
      },
      200
    );
  } catch (error) {
    console.error("InternshipType Colleges Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getInternshipTypeColleges = getInternshipTypeColleges;

// Delete a CoSheet row by ID
const deleteCoSheet = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return ReE(res, "CoSheet ID is required", 400);

    const record = await model.CoSheet.findByPk(id);
    if (!record) return ReE(res, "CoSheet record not found", 404);

    await record.destroy();
    return ReS(res, { success: true, message: "CoSheet deleted successfully" }, 200);
  } catch (error) {
    console.error("CoSheet Delete Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.deleteCoSheet = deleteCoSheet;

// Get all CoSheets where JD has been sent
const getCoSheetsWithJDSent = async (req, res) => {
  try {
    const records = await model.CoSheet.findAll({
      where: {
        detailedResponse: "Send JD", // ✔ UPDATED (replaced jdSentAt != null)
      },
      order: [["jdSentAt", "DESC"]],
    });

    const managers = await model.TeamManager.findAll({
      where: { isActive: true, isDeleted: false },
      attributes: ["id", "name", "email"],
      order: [["name", "ASC"]],
    });

    return ReS(res, { success: true, data: records, managers }, 200);
  } catch (error) {
    console.error("CoSheet Fetch JD Sent Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCoSheetsWithJDSent = getCoSheetsWithJDSent;


const getColleges = async (req, res) => {
  try {
    const { state, city } = req.query;

    if (!state) {
      return ReE(res, "state is required", 400);
    }

    let query = `
      SELECT DISTINCT ON (
        LOWER(
          REPLACE(
            REPLACE(
              REPLACE("collegeName", '&', 'and'),
            ',', ''),
          '.', '')
        )
      )
        "collegeName"
      FROM "CoSheets"
      WHERE LOWER("state") = LOWER(:state)
    `;

    const replacements = { state };

    if (city) {
      query += ` AND LOWER("city") = LOWER(:city)`;
      replacements.city = city;
    }

    query += `
      ORDER BY
        LOWER(
          REPLACE(
            REPLACE(
              REPLACE("collegeName", '&', 'and'),
            ',', ''),
          '.', '')
        ),
        "collegeName"
    `;

    const data = await model.sequelize.query(query, {
      replacements,
      type: model.Sequelize.QueryTypes.SELECT,
    });

    return ReS(res, { count: data.length, data }, 200);

  } catch (error) {
    console.error("Error fetching colleges:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getColleges = getColleges;



const getEmailStatusByRow = async (req, res) => {
  try {
    const { rowId, email } = req.query;

    if (!rowId || !email) {
      return ReE(res, "rowId and email are required", 400);
    }

    // 1. Find the CoSheet row
    const coSheet = await model.CoSheet.findOne({
      where: { id: rowId, isActive: true },
    });

    if (!coSheet) {
      return ReE(res, "CoSheet row not found", 404);
    }

    // 2. Call fundsweb to get email open status
    let emailStatus = null;
    try {
      const fundswebRes = await axios.get(
        `https://api.fundsweb.in/api/v1/emailtracking/email/open-status`,
        { params: { email } }
      );
      emailStatus = fundswebRes.data?.data || null;
    } catch (err) {
      if (err.response?.status === 404) {
        // Email was never sent via fundsweb — return cleanly
        return ReS(res, {
          success: true,
          rowId,
          email,
          emailStatus: {
            isOpened: false,
            openCount: 0,
            openedAt: null,
            deviceType: null,
            browser: null,
            os: null,
            lastCheckedAt: null,
            message: "Email not sent via fundsweb"
          }
        }, 200);
      }

      // Any other error
      console.error("Fundsweb call failed:", err.message);
      return ReE(res, "Could not reach fundsweb", 502);
    }

    // 3. Save the fetched status into CoSheet row
    if (emailStatus) {
      await coSheet.update({
        jdEmailIsOpened: emailStatus.isOpened || false,
        jdEmailOpenCount: emailStatus.openCount || 0,
        jdEmailOpenedAt: emailStatus.openedAt || null,
        jdEmailDeviceType: emailStatus.deviceType || null,
        jdEmailBrowser: emailStatus.browser || null,
        jdEmailOs: emailStatus.os || null,
        jdEmailLastCheckedAt: new Date(),
      });
    }

    return ReS(
      res,
      {
        success: true,
        rowId,
        email,
        emailStatus: {
          isOpened: coSheet.jdEmailIsOpened,
          openCount: coSheet.jdEmailOpenCount,
          openedAt: coSheet.jdEmailOpenedAt,
          deviceType: coSheet.jdEmailDeviceType,
          browser: coSheet.jdEmailBrowser,
          os: coSheet.jdEmailOs,
          lastCheckedAt: coSheet.jdEmailLastCheckedAt,
        },
      },
      200
    );

  } catch (error) {
    console.error("getEmailStatusByRow error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getEmailStatusByRow = getEmailStatusByRow;