"use strict";

const AWS = require("aws-sdk");
const puppeteer = require("puppeteer");
const CONFIG = require("../config/config");
const model = require("../models");

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
      {
        model: model.Course,
        attributes: ["name"],
      },
      {
        model: model.Domain,
        attributes: ["name"],
      },
    ],
  });

  if (!courseDetailRows.length) return { sessions: [], domain: "", courseName: "" };

  const domain = courseDetailRows[0].Domain?.name || "";
  const courseName = courseDetailRows[0].Course?.name || "";

  const sessions = courseDetailRows.map((session) => ({
    day: session.day,
    title: session.title || `Session ${session.day}`,
    videoDuration: "~15 mins",
    startDate: "N/A",
    endDate: "N/A",
    mcqs: session.QuestionModels.map((q) => ({
      question: q.question,
      options: [
        { key: "A", text: q.optionA },
        { key: "B", text: q.optionB },
        { key: "C", text: q.optionC },
        { key: "D", text: q.optionD },
      ],
      answer: q.answer,
    })),
  }));

  return { sessions, domain, courseName };
};

const generateMCQCaseStudyReport = async (options = {}) => {
  const courseId = options.courseId || 1;
  const internName = options.internName || "";
  const userProgress = options.userProgress || {}; // new: session evaluation data

  const { sessions, domain, courseName } = await fetchSessionsWithMCQs(courseId);

  const bgUrl = options.bgUrl || `${ASSET_BASE}/internshipbg.png`;
  const generatedOn = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const sessionsHtml =
    sessions.length > 0
      ? sessions
          .map((s) => {
            const mcqChunks = [];
            const chunkSize = 3; // 3 questions per page
            for (let i = 0; i < s.mcqs.length; i += chunkSize) {
              mcqChunks.push(s.mcqs.slice(i, i + chunkSize));
            }

            return mcqChunks
              .map((chunk) => {
                const mcqHtml = chunk
                  .map((q, idx) => {
                    const optionsHtml = (q.options || [])
                      .map((opt) =>
                        opt.key === q.answer
                          ? `<li style="font-weight:bold; color:green;">${escapeHtml(opt.text)}</li>`
                          : `<li>${escapeHtml(opt.text)}</li>`
                      )
                      .join("");

                    return `
                      <p><b>Question:</b> ${escapeHtml(q.question)}</p>
                      <ul style="margin:0 0 10px 20px;">${optionsHtml}</ul>
                    `;
                  })
                  .join("");

                // Prepare score table if userProgress exists for this session
                const progress = userProgress[s.day];
                const scoreTableHtml = progress
                  ? `
                  <table border="1" cellpadding="6" cellspacing="0" style="margin-top:15px; border-collapse: collapse; width:50%;">
                    <tr style="background:#f0f0f0;">
                      <th>Total Questions</th>
                      <th>Correct</th>
                      <th>Wrong</th>
                    </tr>
                    <tr>
                      <td>${progress.totalMCQs}</td>
                      <td>${progress.correctMCQs}</td>
                      <td>${progress.wrongMCQs}</td>
                    </tr>
                  </table>
                  `
                  : "";

                return `
                <div class="page">
                  <div class="content">
                    <h1>Eduroom Internship Report</h1>
                    <h2>Session ${s.day}</h2>
                    <p><b>Intern Name:</b> ${escapeHtml(internName)}</p>
                    <p><b>Domain:</b> ${escapeHtml(domain)}</p>
                    <p><b>Course:</b> ${escapeHtml(courseName)}</p>
                    <p><b>Session:</b> ${s.day} – ${escapeHtml(s.title)}</p>
                    <p><b>Video Duration:</b> ${s.videoDuration} MCQ + Case Study (~1500 words)</p>
                    <p><b>Start Date:</b> ${s.startDate}</p>
                    <p><b>End Date:</b> ${s.endDate}</p>
                    <h3>MCQ Quiz – Session ${s.day}</h3>
                    ${mcqHtml || "<p>No MCQs available</p>"}
                    ${scoreTableHtml}
                  </div>
                  <div class="footer">Generated by FundsWeb · ${generatedOn}</div>
                </div>`;
              })
              .join("<div style='page-break-after: always;'></div>");
          })
          .join("")
      : `<div class="page">
          <div class="content">
            <h1>Eduroom Internship Report</h1>
            <h2>No Sessions Available</h2>
            <p><b>Intern Name:</b> ${escapeHtml(internName)}</p>
            <p><b>Domain:</b> ${escapeHtml(domain)}</p>
            <p><b>Course:</b> ${escapeHtml(courseName)}</p>
            <p>There is no data available for this course.</p>
          </div>
          <div class="footer">Generated by FundsWeb · ${generatedOn}</div>
        </div>`;

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
        background: url("${bgUrl}") no-repeat center top;
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
      h2 { font-size:20px; margin:10px 0; }
      h3 { font-size:18px; margin-top:12px; }
      p { font-size:16px; margin:4px 0; }
      table { font-size:16px; }
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

  await s3.putObject({
    Bucket: "fundsweb",
    Key: s3Key,
    Body: pdfBuffer,
    ContentType: "application/pdf",
  }).promise();

  return {
    fileName,
    fileUrl: `https://fundsweb.s3.ap-south-1.amazonaws.com/${s3Key}`,
  };
};

module.exports = { generateMCQCaseStudyReport };
