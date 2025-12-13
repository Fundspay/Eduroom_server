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

  const userTarget = user.businessTargets?.[courseId];
  const rawTarget = parseInt(
    userTarget !== undefined ? userTarget : course?.businessTarget || 0,
    10
  );
  const businessTarget = Math.max(0, rawTarget);

  const subscriptionWallet = parseInt(user.subscriptionWallet || 0, 10);
  const deductedWallet = parseInt(user.subscriptiondeductedWallet || 0, 10);
  const achievedTarget = Math.min(subscriptionWallet, deductedWallet);

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
                  : r.caseStudyPercentage !== null
                  ? r.caseStudyPercentage + "%"
                  : "Not Attempted"
              }</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  const businessTargetTable = `
    <table class="details-table">
      <thead>
        <tr>
          <th>Business Target</th>
          <th>Achieved Target</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${businessTarget}</td>
          <td>${achievedTarget}</td>
        </tr>
      </tbody>
    </table>
  `;

  // ======== Split mergedSessions into chunks of 15 for completion ========
  const chunkSize = 15;
  const completionChunks = [];
  for (let i = 0; i < mergedSessions.length; i += chunkSize) {
    completionChunks.push(mergedSessions.slice(i, i + chunkSize));
  }

  // ======== Build HTML for completion summary pages ========
  const completionPagesHtml = completionChunks
    .map((chunk, index) => {
      const isLastPage = index === completionChunks.length - 1;
      return `
      <div class="page">
        <div class="content">
          <div class="main-title">Internship Completion Summary</div>
          ${renderTable(chunk, "completion")}
          ${isLastPage ? `<br/>${businessTargetTable}` : ""}
        </div>
        <div class="footer">© EduRoom Internship Report · ${today}</div>
      </div>
      ${isLastPage ? "" : '<div class="page-break"></div>'}
      `;
    })
    .join("");

  // ======== Split filteredCaseStudySessions into chunks of 15 ========
  const caseStudyChunks = [];
  for (let i = 0; i < filteredCaseStudySessions.length; i += chunkSize) {
    caseStudyChunks.push(filteredCaseStudySessions.slice(i, i + chunkSize));
  }

  // ======== Build HTML for case study pages ========
  const caseStudyPagesHtml = caseStudyChunks
    .map((chunk, index) => {
      const isLastPage = index === caseStudyChunks.length - 1;
      return `
      <div class="page">
        <div class="content">
          <div class="main-title">Case Study Performance Summary</div>
          ${renderTable(chunk, "caseStudy")}
          ${
            isLastPage
              ? `<div class="declaration">
                  Hereby, it is declared that the intern has successfully completed the Eduroom Internship and Live Project as part of the training program. The intern has actively participated in the sessions, completed the assigned MCQs and case studies, and demonstrated a practical understanding of the concepts and skills covered during the course. This report serves as an official record of the intern’s performance and progress throughout the program.
                </div>
                <img src="https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/pooja+mam+signature.png" class="signature" />`
              : ""
          }
        </div>
        <div class="footer">© EduRoom Internship Report · ${today}</div>
      </div>
      ${isLastPage ? "" : '<div class="page-break"></div>'}
      `;
    })
    .join("");

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
      .declaration {
        margin-top: 30px;
        font-size: 15px;
        line-height: 1.6;
        text-align: justify;
      }
      .stamp {
        position: absolute;
        left: 38%;
        bottom: 200px;
        width: 120px;
        height: auto;
      }
      .signature {
    position: absolute;
    bottom: 150px; /* distance from bottom */
    left: 50%;
    transform: translateX(-50%); /* center horizontally */
    width: 700px; /* adjust width as needed */
    height: 200px; /* maintain aspect ratio */
}


    </style>
  </head>
  <body>
    ${completionPagesHtml}
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
