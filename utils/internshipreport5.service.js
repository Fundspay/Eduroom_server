"use strict";
const AWS = require("aws-sdk");
const puppeteer = require("puppeteer");
const CONFIG = require("../config/config");
const model = require("../models");
const { Op } = require("sequelize");

const s3 = new AWS.S3({
  accessKeyId: CONFIG.awsAccessKeyId,
  secretAccessKey: CONFIG.awsSecretAccessKey,
  region: CONFIG.awsRegion,
});

const ASSET_BASE =
  CONFIG.assetBase ||
  "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets";

const escapeHtml = (str) => {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

// =======================
// FETCH SESSIONS WITH MCQS
// =======================
const fetchSessionsWithMCQs = async (courseId) => {
  if (!courseId) courseId = 1;

  const courseDetailRows = await model.CourseDetail.findAll({
    where: { courseId, isDeleted: false },
    order: [
      ["day", "ASC"],
      ["sessionNumber", "ASC"],
    ],
    include: [
      {
        model: model.QuestionModel,
        where: { isDeleted: false },
        required: false,
        attributes: ["id", "question", "answer"],
      },
    ],
  });

  return courseDetailRows.map((session) => {
    const mcqs = session.QuestionModels.map((q) => ({
      id: q.id,
      answer: q.answer,
    }));
    return {
      id: session.id,
      day: session.day,
      sessionNumber: session.sessionNumber,
      title: session.title || `Session ${session.day}`,
      mcqs,
    };
  });
};

// =======================
// FETCH ALL CASE STUDIES PER SESSION FOR USER
// =======================
const fetchAllCaseStudies = async ({ courseId, userId }) => {
  if (!courseId || !userId) return [];

  const courseDetailRows = await model.CourseDetail.findAll({
    where: { courseId, isDeleted: false },
    order: [
      ["day", "ASC"],
      ["sessionNumber", "ASC"],
    ],
    include: [
      {
        model: model.QuestionModel,
        where: { isDeleted: false },
        required: false,
        attributes: ["id", "caseStudy", "answer"],
      },
    ],
  });

  const caseStudyResults = await model.CaseStudyResult.findAll({
    where: { courseId, userId },
    attributes: ["questionId", "matchPercentage"],
  });

  const resultMap = {};
  caseStudyResults.forEach((r) => (resultMap[String(r.questionId)] = r));

  return courseDetailRows.map((session) => {
    const csList =
      session.QuestionModels?.filter((q) => q.caseStudy?.trim()) || [];
    const totalCS = csList.length;
    const totalMatch = csList.reduce((acc, cs) => {
      const res = resultMap[String(cs.id)];
      return acc + (res?.matchPercentage || 0);
    }, 0);
    const percentage = totalCS > 0 ? totalMatch / totalCS : 0;

    return {
      id: session.id,
      day: session.day,
      sessionNumber: session.sessionNumber,
      title: session.title || `Session ${session.day}`,
      caseStudyPercentage: parseFloat(percentage.toFixed(2)),
    };
  });
};

// =======================
// FINAL PAGE GENERATION
// =======================
const finalpageinternshipreport = async ({ courseId, userId }) => {
  if (!userId) throw new Error("Missing userId");

  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false },
  });
  if (!user) throw new Error("User not found");

  const firstName = user.firstName || "";
  const lastName = user.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();

  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const mcqSessions = await fetchSessionsWithMCQs(courseId);
  const csSessions = await fetchAllCaseStudies({ courseId, userId });

  // Merge MCQ and Case Study percentages
  const mergedSessions = mcqSessions.map((s, index) => {
    const cs = csSessions.find((c) => c.sessionNumber === s.sessionNumber);
    const totalMCQs = s.mcqs.length;
    const correctMCQs = s.mcqs.filter((q) => q.answer).length;
    const mcqPercentage = totalMCQs > 0 ? (correctMCQs / totalMCQs) * 100 : 0;

    return {
      srNo: index + 1,
      session: s.title,
      completion: parseFloat(
        ((mcqPercentage + (cs?.caseStudyPercentage || 0)) / 2).toFixed(2)
      ),
      caseStudyPercentage: cs?.caseStudyPercentage || 0,
    };
  });

  const renderTable = (rows, type = "completion") => `
    <table class="details-table">
      <thead>
        <tr>
          <th>Sr No.</th>
          <th>Session</th>
          <th>${type === "completion" ? "Completion %" : "Case Study %"}</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
            <tr>
              <td>${r.srNo}</td>
              <td style="text-align:left;">${escapeHtml(r.session)}</td>
              <td>${type === "completion" ? r.completion : r.caseStudyPercentage}%</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Internship Report - ${fullName}</title>
    <style>
      body { margin:0; padding:0; font-family:'Times New Roman', serif; }
      .page {
        width:100%;
        min-height:100vh;
        background: url("${ASSET_BASE}/internshipbg.png") no-repeat center top;
        background-size: cover;
        display:flex;
        flex-direction:column;
        position:relative;
        box-sizing:border-box;
      }
      .content {
        background: rgba(255,255,255,0.85);
        margin:130px 40px 60px 40px;
        padding:30px 40px;
        border-radius:8px;
        box-sizing:border-box;
      }
      .main-title {
        font-size:26px;
        font-weight:bold;
        text-align:center;
        margin-bottom:20px;
        text-transform: uppercase;
      }
      .details-table {
        width:100%;
        border-collapse: collapse;
        margin: 0 auto;
      }
      .details-table th, .details-table td {
        border:1px solid #000;
        padding:8px 10px;
        font-size:14px;
        text-align:center;
        vertical-align:middle;
      }
      .details-table th {
        background-color:#f0f0f0;
      }
      .footer {
        position:absolute;
        bottom:10px;
        width:100%;
        text-align:center;
        font-size:14px;
        color:#444;
      }
      .page-break { page-break-after: always; }
    </style>
  </head>
  <body>
    <!-- PAGE 1 -->
    <div class="page">
      <div class="content">
        <div class="main-title">Internship Completion Summary</div>
        ${renderTable(mergedSessions, "completion")}
      </div>
      <div class="footer">© EduRoom Internship Report · ${today}</div>
    </div>

    <div class="page-break"></div>

    <!-- PAGE 2 -->
    <div class="page">
      <div class="content">
        <div class="main-title">Case Study Performance Summary</div>
        ${renderTable(mergedSessions, "caseStudy")}
      </div>
      <div class="footer">© EduRoom Internship Report · ${today}</div>
    </div>
  </body>
  </html>
  `;

  // Generate PDF
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.evaluateHandle("document.fonts.ready");
  await new Promise((r) => setTimeout(r, 300));

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" },
  });

  await browser.close();
  return pdfBuffer;
};

module.exports = { finalpageinternshipreport };
