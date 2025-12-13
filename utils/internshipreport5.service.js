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
// FETCH ALL CASE STUDIES
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
        attributes: ["id", "caseStudy"],
      },
    ],
  });

  const caseStudyResults = await model.CaseStudyResult.findAll({
    where: { courseId, userId },
    attributes: ["questionId", "matchPercentage"],
  });

  const resultMap = {};
  caseStudyResults.forEach(
    (r) => (resultMap[String(r.questionId)] = r.matchPercentage)
  );

  const filteredSessions = courseDetailRows.filter(
    (session) =>
      session.QuestionModels &&
      session.QuestionModels.some((q) => q.caseStudy && q.caseStudy.trim())
  );

  return filteredSessions.map((session) => {
    const csList =
      session.QuestionModels?.filter((q) => q.caseStudy?.trim()) || [];
    const totalCS = csList.length;
    const totalMatch = csList.reduce((acc, cs) => {
      const match = resultMap[String(cs.id)];
      return acc + (match || 0);
    }, 0);
    const avgPercentage = totalCS > 0 ? totalMatch / totalCS : 0;

    return {
      id: session.id,
      day: session.day,
      sessionNumber: session.sessionNumber,
      title: session.title || `Session ${session.day}`,
      caseStudyPercentage:
        totalCS > 0 ? parseFloat(avgPercentage.toFixed(2)) : null,
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

  const course = await model.Course.findOne({
    where: { id: courseId, isDeleted: false },
  });
  if (!course) throw new Error("Course not found");

  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();

  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const mcqSessions = await fetchSessionsWithMCQs(courseId);
  const csSessions = await fetchAllCaseStudies({ courseId, userId });

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
      caseStudyPercentage: cs?.caseStudyPercentage ?? null,
    };
  });

  const filteredCaseStudySessions = mergedSessions.filter(
    (s) => s.caseStudyPercentage !== null
  );

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
            (r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td style="text-align:left;">${escapeHtml(r.session)}</td>
              <td>${
                type === "completion"
                  ? r.completion
                  : r.caseStudyPercentage + "%"
              }</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  // =======================
  // 15 ROWS PER PAGE LOGIC
  // =======================
  const chunkSize = 15;

  const chunkArray = (arr) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
      chunks.push(arr.slice(i, i + chunkSize));
    }
    return chunks;
  };

  const summaryChunks = chunkArray(mergedSessions);
  const caseStudyChunks = chunkArray(filteredCaseStudySessions);

  const summaryPagesHtml = summaryChunks
    .map(
      (chunk, index) => `
      <div class="page">
        <div class="content">
          <div class="main-title">Internship Completion Summary</div>
          ${renderTable(chunk, "completion")}
        </div>
        <div class="footer">© EduRoom Internship Report · ${today}</div>
      </div>
      ${index < summaryChunks.length - 1 ? '<div class="page-break"></div>' : ""}
    `
    )
    .join("");

  const caseStudyPagesHtml = caseStudyChunks
    .map(
      (chunk, index) => `
      <div class="page">
        <div class="content">
          <div class="main-title">Case Study Performance Summary</div>
          ${renderTable(chunk, "caseStudy")}
        </div>
        <div class="footer">© EduRoom Internship Report · ${today}</div>
      </div>
      ${index < caseStudyChunks.length - 1 ? '<div class="page-break"></div>' : ""}
    `
    )
    .join("");

  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin:0; padding:0; font-family:'Times New Roman', serif; }
      .page {
        width:100%;
        min-height:100vh;
        background: url("${ASSET_BASE}/internshipbg.png") no-repeat center top;
        background-size: cover;
        position:relative;
      }
      .content {
        background: rgba(255,255,255,0.85);
        margin:130px 40px 60px 40px;
        padding:30px 40px;
        border-radius:8px;
      }
      .main-title {
        font-size:26px;
        font-weight:bold;
        text-align:center;
        margin-bottom:20px;
      }
      .details-table {
        width:100%;
        border-collapse: collapse;
      }
      .details-table th, .details-table td {
        border:1px solid #000;
        padding:8px;
        font-size:14px;
        text-align:center;
      }
      .footer {
        position:absolute;
        bottom:10px;
        width:100%;
        text-align:center;
        font-size:14px;
      }
      .page-break { page-break-after: always; }
    </style>
  </head>
  <body>

    ${summaryPagesHtml}

    <div class="page-break"></div>

    ${caseStudyPagesHtml}

  </body>
  </html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();

  return pdfBuffer;
};

module.exports = { finalpageinternshipreport };
