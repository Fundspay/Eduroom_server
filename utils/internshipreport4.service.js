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
const fetchAllCaseStudies = async ({ courseId, userId }) => {
  if (!courseId) return { sessions: [], domain: "", courseName: "" };

  try {
    // =======================
    // 1️ Fetch course details + case study questions
    // =======================
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
          attributes: ["id", "caseStudy", "question", "day", "sessionNumber"],
        },
        { model: model.Course, attributes: ["name"] },
        { model: model.Domain, attributes: ["name"] },
      ],
    });

    if (!courseDetailRows.length) {
      console.warn(" No courseDetailRows found for courseId:", courseId);
      return { sessions: [], domain: "", courseName: "" };
    }

    const domain = courseDetailRows[0].Domain?.name || "";
    const courseName = courseDetailRows[0].Course?.name || "";

    console.log(
      ` Course details loaded: ${courseName} (${domain}) | Total Sessions: ${courseDetailRows.length}`
    );

    // =======================
    // 2 Fetch all CaseStudyResults for this user & course
    // =======================
    let results = [];
    if (userId) {
      results = await model.CaseStudyResult.findAll({
        where: { userId, courseId },
        attributes: [
          "id",
          "courseId",
          "userId",
          "day",
          "sessionNumber",
          "questionId",
          "answer",
          "matchPercentage",
          "passed",
        ],
      });

      console.log(
        ` CaseStudyResults fetched for userId=${userId}, courseId=${courseId}: ${results.length}`
      );
    } else {
      console.warn("⚠️ userId not provided — skipping result matching");
    }

    // =======================
    // 3️ Map sessions and match case studies across days/sessions
    // =======================
    const sessions = [];

    for (const session of courseDetailRows) {
      const caseStudyQs = session.QuestionModels?.filter(
        (q) => q.caseStudy && q.caseStudy.trim() !== ""
      );

      console.log(
        ` Processing session: id=${session.id}, day=${session.day}, sessionNumber=${session.sessionNumber}, caseStudyQs=${caseStudyQs?.length || 0}`
      );

      if (!caseStudyQs || caseStudyQs.length === 0) continue;

      const caseStudies = [];

      for (const cs of caseStudyQs) {
        // loop through all results to find one that matches this question across days/sessions
        const matchedResult = results.find(
          (r) =>
            Number(r.questionId) === Number(cs.id) &&
            Number(r.courseId) === Number(courseId) &&
            Number(r.userId) === Number(userId) &&
            Number(r.day) === Number(session.day)
        );

        if (matchedResult) {
          console.log(
            ` Match found for questionId=${cs.id}, userId=${userId}, day=${session.day}, session=${session.sessionNumber}`
          );
        } else {
          console.log(
            ` No match for questionId=${cs.id}, userId=${userId}, day=${session.day}, session=${session.sessionNumber}`
          );
        }

        caseStudies.push({
          id: cs.id,
          question: cs.caseStudy,
          answer: matchedResult?.answer || "",
          matchPercentage: matchedResult?.matchPercentage || 0,
          passed: matchedResult?.passed || false,
        });
      }

      sessions.push({
        id: session.id,
        day: session.day,
        sessionNumber: session.sessionNumber,
        title: session.title || `Session ${session.day}`,
        caseStudies,
      });
    }

    // =======================
    // 4️ Final result
    // =======================
    console.log(
      ` Final sessions mapped: ${sessions.length} | User: ${userId} | Course: ${courseId}`
    );

    return { sessions, domain, courseName };
  } catch (err) {
    console.error("🔥 Error fetching case studies:", err);
    return { sessions: [], domain: "", courseName: "" };
  }
};


// =======================
// MAIN REPORT GENERATION FUNCTION
// =======================
const generateMCQCaseStudyReport = async (options = {}) => {
  const courseId = options.courseId || 1;
  const internName = options.internName || "";
  const userId = options.userId || null;
  const coursePreviewId = options.coursePreviewId || 1;

  const { sessions, domain, courseName } = await fetchSessionsWithMCQs(courseId);
  const { sessions: allCaseStudies } = await fetchAllCaseStudies({ courseId, userId });

  const bgUrl = options.bgUrl || `${ASSET_BASE}/internshipbg.png`;
  const generatedOn = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // MCQ Section (unchanged)
  const sessionsHtml =
    sessions.length > 0
      ? sessions
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

            return `
            <div class="page">
              <div class="content">
                <h1>Eduroom Internship Report</h1>
                <h2>Session ${s.day}</h2>
                <p><b>Intern Name:</b> ${escapeHtml(internName)}</p>
                <p><b>Domain:</b> ${escapeHtml(domain)}</p>
                <p><b>Course:</b> ${escapeHtml(courseName)}</p>
                <p><b>Session:</b> ${s.day} – ${escapeHtml(s.title)}</p>
                <h3>MCQ Quiz – Session ${s.day}</h3>
                ${mcqHtml || "<p>No MCQs available</p>"}
              </div>
              <div class="footer">Generated by FundsWeb · ${generatedOn}</div>
            </div>`;
          })
          .join("<div style='page-break-after: always;'></div>")
      : `<div class="page"><div class="content"><h1>No Sessions Available</h1></div></div>`;

  // ✅ Case Studies Section — now includes answers below each question
  const caseStudiesHtml =
    allCaseStudies.length > 0
      ? allCaseStudies
          .map((session) => {
            const csHtml = session.caseStudies
              .map(
                (cs, idx) => `
                <p><b>Case Study ${idx + 1}:</b> ${escapeHtml(cs.question)}</p>
                <p style="margin-left:20px;"><b>User Answer:</b><br>${escapeHtml(
                  cs.answer
                )}</p>
                <table border="1" cellpadding="6" cellspacing="0" style="margin-top:10px; border-collapse: collapse; width:70%;">
                  <tr style="background:#f0f0f0; text-align:center;">
                    <th>Match %</th>
                    <th>Passed</th>
                  </tr>
                  <tr style="text-align:center;">
                    <td style="color:#00bfa5; font-weight:bold;">${
                      cs.matchPercentage || 0
                    }%</td>
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
              </div>`;
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
      .page { width:100%; min-height:100vh; background: url("${bgUrl}") no-repeat center top; background-size: cover; display:flex; flex-direction:column; position:relative; color:#000; }
      .content { background: rgba(255,255,255,0.85); margin:135px 40px 60px 40px; padding:30px 40px; border-radius:8px; }
      h1 { font-size:28px; font-weight:bold; text-align:center; }
      h2 { font-size:20px; margin:10px 0; }
      h3 { font-size:18px; margin-top:12px; }
      p { font-size:16px; margin:4px 0; }
      .footer { position:absolute; bottom:10px; width:100%; text-align:center; font-size:14px; color:#444; }
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

  const timestamp = Date.now();
  const fileName = `mcq-case-report-${timestamp}.pdf`;
  const s3Key = `internshipReports/mcq-case/${fileName}`;

  await s3
    .putObject({
      Bucket: "fundsweb",
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
    .promise();

  return {
    fileName,
    fileUrl: `https://fundsweb.s3.ap-south-1.amazonaws.com/${s3Key}`,
  };
};

module.exports = { generateMCQCaseStudyReport };
