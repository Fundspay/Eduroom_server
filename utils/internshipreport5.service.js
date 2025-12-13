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

  const filteredCaseStudySessions = mergedSessions.filter(
    (s) => s.caseStudyPercentage !== null
  );

  // ✅ ONLY NEW LOGIC (NOTHING ELSE TOUCHED)
  const CASE_STUDY_PAGE_LIMIT = 15;

  const caseStudyMainRows =
    filteredCaseStudySessions.length > CASE_STUDY_PAGE_LIMIT
      ? filteredCaseStudySessions.slice(
          0,
          filteredCaseStudySessions.length - CASE_STUDY_PAGE_LIMIT
        )
      : filteredCaseStudySessions;

  const caseStudyLastRows =
    filteredCaseStudySessions.length > CASE_STUDY_PAGE_LIMIT
      ? filteredCaseStudySessions.slice(-CASE_STUDY_PAGE_LIMIT)
      : [];

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
              <td>${r.caseStudyPercentage}%</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  const html = `
  <!doctype html>
  <html>
  <body>

    <!-- PAGE 2 -->
    <div class="page">
      <div class="content">
        <div class="main-title">Case Study Performance Summary</div>
        ${renderTable(caseStudyMainRows, "caseStudy")}
      </div>
    </div>

    ${
      caseStudyLastRows.length
        ? `
      <div class="page-break"></div>

      <!-- PAGE 3 -->
      <div class="page">
        <div class="content">
          <div class="main-title">Case Study Performance Summary (Continued)</div>
          ${renderTable(caseStudyLastRows, "caseStudy")}
        </div>
      </div>
    `
        : ""
    }

  </body>
  </html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
  });

  await browser.close();
  return pdfBuffer;
};

module.exports = { finalpageinternshipreport };
