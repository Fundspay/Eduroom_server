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
        attributes: [
          "id",
          "question",
          "optionA",
          "optionB",
          "optionC",
          "optionD",
          "answer",
        ],
      },
      { model: model.Course, attributes: ["name"] },
      { model: model.Domain, attributes: ["name"] },
    ],
  });

  if (!courseDetailRows.length)
    return { sessions: [], domain: "", courseName: "" };

  const domain = courseDetailRows[0].Domain?.name || "";
  const courseName = courseDetailRows[0].Course?.name || "";

  const sessions = courseDetailRows.map((session) => ({
    id: session.id,
    day: session.day,
    sessionNumber: session.sessionNumber,
    title: session.title || `Session ${session.day}`,
    videoDuration: "~15 mins",
    startDate: "N/A",
    endDate: "N/A",
    mcqs: session.QuestionModels.map((q) => ({
      id: q.id,
      question: q.question,
      options: [
        { key: "A", text: q.optionA },
        { key: "B", text: q.optionB },
        { key: "C", text: q.optionC },
        { key: "D", text: q.optionD },
      ],
      answer: q.answer,
    })),
    userProgress: session.userProgress || {},
  }));

  return { sessions, domain, courseName };
};

// =======================
// FETCH ALL CASE STUDIES PER SESSION FOR USER
// =======================
const fetchAllCaseStudies = async ({ courseId, userId, req }) => {
  if (!userId && req?.user?.id) {
    userId = req.user.id;
  }

  if (!courseId) {
    return { sessions: [], domain: "", courseName: "" };
  }

  try {
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
          attributes: [
            "id",
            "caseStudy",
            "question",
            "day",
            "sessionNumber",
            "answer",
          ],
        },
        { model: model.Course, attributes: ["name"] },
        { model: model.Domain, attributes: ["name"] },
      ],
    });

    if (!courseDetailRows.length) {
      return { sessions: [], domain: "", courseName: "" };
    }

    const domain = courseDetailRows[0].Domain?.name || "";
    const courseName = courseDetailRows[0].Course?.name || "";

    let resultMap = {};
    if (userId) {
      const results = await model.CaseStudyResult.findAll({
        where: { userId, courseId },
        attributes: ["questionId", "answer", "matchPercentage", "passed"],
      });
      results.forEach((r) => {
        resultMap[String(r.questionId)] = r;
      });
    }

    const sessions = courseDetailRows
      .map((session) => {
        const csList = session.QuestionModels?.filter(
          (q) => q.caseStudy?.trim()
        );
        if (!csList || csList.length === 0) return null;

        const caseStudies = csList.map((cs) => {
          const userResult = resultMap[String(cs.id)] || {};
          return {
            id: cs.id,
            question: cs.caseStudy,
            correctAnswer: cs.answer || "",
            userAnswer: userResult.answer ?? "N/A",
            matchPercentage: userResult.matchPercentage ?? 0,
            passed: userResult.passed ?? false,
            courseId,
            userId: userId ?? null,
          };
        });

        return {
          id: session.id,
          day: session.day,
          sessionNumber: session.sessionNumber,
          title: session.title || `Session ${session.day}`,
          caseStudies,
        };
      })
      .filter(Boolean);

    return { sessions, domain, courseName };
  } catch (err) {
    return { sessions: [], domain: "", courseName: "" };
  }
};

// =======================
// MAIN REPORT GENERATION FUNCTION
// =======================
const generateMCQCaseStudyReport = async (options = {}) => {
  const courseId = options.courseId || 1;
  let userId = options.userId || null;

  if (!userId && options.req?.user?.id) {
    userId = options.req.user.id;
  }

  let courseDates = null;
  if (userId) {
    const user = await model.User.findOne({
      where: { id: userId, isDeleted: false },
      attributes: ["courseDates"],
    });

    if (user?.courseDates) {
      courseDates = user.courseDates[String(courseId)] || null;
    }
  }

  const { sessions, domain, courseName } = await fetchSessionsWithMCQs(courseId);
  const { sessions: allCaseStudies } = await fetchAllCaseStudies({
    courseId,
    userId,
    req: options.req,
  });

  const sessionsWithDates = sessions.map((s) => ({
    ...s,
    startDate: courseDates?.startDate || "N/A",
    endDate: courseDates?.endDate || "N/A",
  }));

  const bgUrl = options.bgUrl || `${ASSET_BASE}/internshipbg.png`;
  const generatedOn = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const sessionsHtml =
    sessionsWithDates.length > 0
      ? sessionsWithDates
          .map((s) => {
            const mcqHtml = s.mcqs
              .map((q, idx) => {
                const optionsHtml = (q.options || [])
                  .map((opt) =>
                    opt.key === q.answer
                      ? `<li style="font-weight:bold; color:green;">${escapeHtml(
                          opt.text
                        )}</li>`
                      : `<li>${escapeHtml(opt.text)}</li>`
                  )
                  .join("");
                return ` 
                  <p><b>Question ${idx + 1}:</b> ${escapeHtml(q.question)}</p>
                  <ul style="margin:0 0 10px 20px;">${optionsHtml}</ul>
                `;
              })
              .join("");

            const totalMCQs = s.mcqs.length || 0;
            const correctMCQs = s.mcqs.filter((q) => q.answer).length;
            const percentage =
              totalMCQs > 0 ? ((correctMCQs / totalMCQs) * 100).toFixed(2) : "0.00";
            const status = percentage >= 60 ? "PASSED" : "FAILED";

            const scoreTableHtml = `
              <table border="1" cellpadding="6" cellspacing="0" 
                style="margin-top:15px; border-collapse: collapse; width:70%; text-align:center;">
                <tr style="background:#f0f0f0;">
                  <th>Score</th>
                  <th>PERCENTAGE</th>
                  <th>STATUS</th>
                </tr>
                <tr>
                  <td style="color:#00bfa5; font-weight:bold;">${correctMCQs}/${totalMCQs}</td>
                  <td style="color:#00bfa5; font-weight:bold;">${percentage}%</td>
                  <td style="font-weight:bold;">${status}</td>
                </tr>
              </table>
            `;

            return `
            <div class="page">
              <div class="content">
                <h1>Eduroom Internship Report</h1>
                <h2>Session ${s.day}</h2>
                <p><b>Domain:</b> ${escapeHtml(domain)}</p>
                <p><b>Course:</b> ${escapeHtml(courseName)}</p>
                <p><b>Session:</b> ${s.day} – ${escapeHtml(s.title)}</p>
                <p><b>Video Duration:</b> ${s.videoDuration} MCQ (~1500 words)</p>
                <p><b>Start Date:</b> ${s.startDate}</p>
                <p><b>End Date:</b> ${s.endDate}</p>
                <h3>MCQ Quiz – Session ${s.day}</h3>
                ${mcqHtml || "<p>No MCQs available</p>"}
                ${scoreTableHtml}
              </div>
              <div class="footer">Generated by FundsWeb · ${generatedOn}</div>
            </div>`;
          })
          .join("<div style='page-break-after: always;'></div>")
      : `<div class="page">
          <div class="content">
            <h1>Eduroom Internship Report</h1>
            <h2>No Sessions Available</h2>
            <p><b>Domain:</b> ${escapeHtml(domain)}</p>
            <p><b>Course:</b> ${escapeHtml(courseName)}</p>
            <p>There is no data available for this course.</p>
          </div>
          <div class="footer">Generated by FundsWeb · ${generatedOn}</div>
        </div>`;

  const caseStudiesHtml =
    allCaseStudies.length > 0
      ? allCaseStudies
          .map((session) => {
            const csHtml = session.caseStudies
              .map(
                (cs, idx) => `
                  <p><b>Question ${idx + 1}:</b> ${escapeHtml(cs.question)}</p>
                  <p><b>Answer Text:</b> ${escapeHtml(cs.userAnswer || "N/A")}</p>
                  <table border="1" cellpadding="6" cellspacing="0" 
                    style="margin-top:10px; border-collapse: collapse; width:70%; text-align:center;">
                    <tr style="background:#f0f0f0;">
                      <th>Match %</th>
                      <th>Passed</th>
                    </tr>
                    <tr>
                      <td style="color:#00bfa5; font-weight:bold;">${cs.matchPercentage || 0}%</td>
                      <td style="font-weight:bold;">${cs.passed ? "Yes" : "No"}</td>
                    </tr>
                  </table>
                `
              )
              .join("");

            return `
            <div class="page">
              <div class="content">
                <h1>Case Studies – Session ${session.day}</h1>
                ${csHtml}
              </div>
              <div class="footer">Generated by FundsWeb · ${generatedOn}</div>
            </div>
            `;
          })
          .join("<div style='page-break-after: always;'></div>")
      : "";

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>MCQ & Case Study Report</title>
    <style>
      body { margin:0; padding:0; font-family:'Times New Roman', serif; }
      .page {
        width:100%;
        min-height:100vh;
        background: url("${options.bgUrl || ASSET_BASE + "/internshipbg.png"}") no-repeat center top;
        background-size: cover;
        display:flex;
        flex-direction:column;
        position:relative;
        color:#000;
        box-sizing:border-box;
      }
      .content {
        background: rgba(255,255,255,0.85);
        margin:135px 40px 60px 40px;
        padding:30px 40px;
        border-radius:8px;
        box-sizing:border-box;
      }
      h1 { font-size:28px; font-weight:bold; text-align:center; margin-bottom:12px; }
      h2 { font-size:20px; margin:10px 0; text-align:center; }
      h3 { font-size:18px; margin-top:12px; text-align:center; }
      p { font-size:16px; margin:4px 0; text-align:center; }
      table { text-align:center; }
      .footer {
        position:absolute;
        bottom:10px;
        width:100%;
        text-align:center;
        font-size:14px;
        color:#444;
      }
    </style>
  </head>
  <body>
    ${sessionsHtml}
    ${caseStudiesHtml}
  </body>
  </html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.evaluateHandle("document.fonts.ready");
  await new Promise((r) => setTimeout(r, 400));

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" },
  });

  await browser.close();

  return pdfBuffer;
};

module.exports = { generateMCQCaseStudyReport };
