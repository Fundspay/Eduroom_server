"use strict";

const AWS = require("aws-sdk");
const puppeteer = require("puppeteer");
const CONFIG = require("../config/config");
const model = require("../models"); // Sequelize models

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

/**
 * Fetch MCQs and Case Study results from DB
 * @param {number} courseId
 */
const fetchSessionsWithMCQs = async (courseId) => {
  if (!courseId) courseId = 1; // default to 1 if missing

  // Fetch distinct session numbers from CaseStudyResults
  const sessionsNumbers = await model.CaseStudyResults.findAll({
    where: { courseId },
    attributes: [
      [model.Sequelize.fn("DISTINCT", model.Sequelize.col("sessionNumber")), "day"],
    ],
    order: [["sessionNumber", "ASC"]],
    raw: true,
  });

  // Build sessions array
  const sessions = [];
  for (let sessionObj of sessionsNumbers) {
    const day = sessionObj.day;

    // Fetch all CaseStudyResults for this session
    const mcqs = await model.CaseStudyResults.findAll({
      where: { courseId, sessionNumber: day },
      attributes: ["questionId", "answer", "day"],
      order: [["id", "ASC"]],
      raw: true,
    });

    sessions.push({
      day,
      title: `Session ${day}`, // You can adjust title if needed
      videoDuration: "~15 mins",
      startDate: "N/A",
      endDate: "N/A",
      mcqs,
    });
  }

  return sessions;
};

const generateMCQCaseStudyReport = async (options = {}) => {
  let courseId = options.courseId || 1; // default to 1 if missing
  const { internName, domain, courseName } = options;

  const sessions = await fetchSessionsWithMCQs(courseId);
  const bgUrl = options.bgUrl || `${ASSET_BASE}/internshipbg.png`;
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Generate HTML for each session
  const sessionsHtml = sessions
    .map((s, idx) => {
      const mcqHtml = s.mcqs
        .map((q, qIdx) => {
          return `
            <p><b>Question ${qIdx + 1}:</b> Question ID ${q.questionId}</p>
            <p><b>Answer:</b> ${escapeHtml(q.answer)}</p>
          `;
        })
        .join("<br/>");

      return `
        <div class="page">
          <div class="content">
            <h2>Session ${s.day}</h2>
            <p><b>Intern Name:</b> ${escapeHtml(internName)}</p>
            <p><b>Domain:</b> ${escapeHtml(domain)}</p>
            <p><b>Course:</b> ${escapeHtml(courseName)}</p>
            <p><b>Session:</b> ${s.day} – ${escapeHtml(s.title)}</p>
            <p><b>Video Duration:</b> ${s.videoDuration} MCQ + Case Study (~1500 words)</p>
            <p><b>Start Date:</b> ${s.startDate}</p>
            <p><b>End Date:</b> ${s.endDate}</p>
            <br/>
            <h3>MCQ Quiz – Session ${s.day}</h3>
            ${mcqHtml || "<p>No MCQs available</p>"}
          </div>
          <div class="footer" style="position:absolute; bottom:10px; width:100%; text-align:center; font-size:14px; color:#444;">
            Generated on ${today}
          </div>
        </div>
      `;
    })
    .join("<div style='page-break-after: always;'></div>");

  // Full HTML document
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Internship Report – MCQs & Case Studies</title>
<style>
  body { margin:0; padding:0; font-family:'Times New Roman', serif; }
  .page {
    width:100%;
    min-height:100vh;
    background: url("${bgUrl}") no-repeat center top;
    background-size: cover;
    display:flex;
    flex-direction:column;
    box-sizing:border-box;
    color:#000;
    position:relative;
  }
  .content {
    background: rgba(255,255,255,0.95);
    margin:60px 40px 60px 40px;
    padding:30px 40px;
    border-radius:8px;
    box-sizing:border-box;
  }
  h2 { font-size:22px; margin-bottom:6px; }
  p { font-size:16px; line-height:1.4; margin:4px 0; }
  h3 { margin-top:12px; font-size:18px; }
</style>
</head>
<body>
  ${sessionsHtml}
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
  await new Promise((r) => setTimeout(r, 500));

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" },
  });

  await page.close();
  await browser.close();

  // Upload to S3
  const s3KeyPrefix = options.bucketPrefix || `internshipReports/mcq-case`;
  const s3Key = `${s3KeyPrefix}/mcq-case-report.pdf`;

  await s3.putObject({
    Bucket: "fundsweb",
    Key: s3Key,
    Body: pdfBuffer,
    ContentType: "application/pdf",
  }).promise();

  return {
    fileName: "mcq-case-report.pdf",
    fileUrl: `https://fundsweb.s3.ap-south-1.amazonaws.com/${s3Key}`,
    s3Key,
  };
};

module.exports = { generateMCQCaseStudyReport };
