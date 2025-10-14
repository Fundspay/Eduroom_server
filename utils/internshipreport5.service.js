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

  const sessions = courseDetailRows.map((session) => {
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

  return sessions;
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

  const sessions = courseDetailRows.map((session) => {
    const csList = session.QuestionModels?.filter((q) => q.caseStudy?.trim()) || [];
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

  return sessions;
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

  // Merge MCQ and Case Study percentages by session
  const mergedSessions = mcqSessions.map((s) => {
    const cs = csSessions.find((c) => c.sessionNumber === s.sessionNumber);
    const totalMCQs = s.mcqs.length;
    const correctMCQs = s.mcqs.filter((q) => q.answer).length;
    const mcqPercentage = totalMCQs > 0 ? (correctMCQs / totalMCQs) * 100 : 0;

    return {
      srNo: s.sessionNumber,
      session: s.title,
      completion: parseFloat(
        ((mcqPercentage + (cs?.caseStudyPercentage || 0)) / 2).toFixed(2)
      ),
    };
  });

  const tableRowsHtml = mergedSessions
    .map(
      (s) =>
        `<tr>
          <td style="text-align:center;">${s.srNo}</td>
          <td style="text-align:left; padding-left:8px;">${escapeHtml(s.session)}</td>
          <td style="text-align:center;">${s.completion}%</td>
        </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Final Internship Report</title>
  <style>
    body { font-family:'Arial',sans-serif; margin:0; padding:0; }
    .page { width:100%; min-height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; }
    h1 { text-align:center; margin-bottom:30px; }
    table { width:80%; border-collapse:collapse; }
    th, td { border:1px solid #000; padding:8px; }
    th { background:#f0f0f0; }
  </style>
</head>
<body>
  <div class="page">
    <h1>Internship Completion Summary</h1>
    <table>
      <tr>
        <th>Sr No.</th>
        <th>Session</th>
        <th>Completion</th>
      </tr>
      ${tableRowsHtml}
    </table>
    <div style="margin-top:30px; text-align:center;">Generated for ${escapeHtml(fullName)} on ${today}</div>
  </div>
</body>
</html>
`;

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
    margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
  });

  await browser.close();

  return pdfBuffer;
};

module.exports = { finalpageinternshipreport };
