"use strict";

const AWS = require("aws-sdk");
const puppeteer = require("puppeteer");
const CONFIG = require("../config/config");

const s3 = new AWS.S3({
  accessKeyId: CONFIG.awsAccessKeyId,
  secretAccessKey: CONFIG.awsSecretAccessKey,
  region: CONFIG.awsRegion,
});

const ASSET_BASE = CONFIG.assetBase || "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets";

const escapeHtml = (str) => {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

const formatDateReadable = (input) => {
  if (!input) return "";
  const d = new Date(input);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const generateSessionReport = async (sessionData = {}, options = {}) => {
  const {
    userId,
    userName,
    domainName,
    courseId,
    courseName,
    day,
    sessionNumber,
    sessionTitle,
    sessionDuration,
    startDate,
    endDate,
    mcqs = [],
    caseStudyResult = null,
  } = sessionData;

  const bgUrl = options.bgUrl || `${ASSET_BASE}/internshipbg.png`;
  const title = `${courseName || ""} Internship Report – Session ${sessionNumber}`;
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  body {
    margin: 0;
    padding: 0;
    font-family: 'Times New Roman', serif;
  }
  .page {
    width: 100%;
    min-height: 100vh;
    position: relative;
    box-sizing: border-box;
  }
  .header {
    height: 150px; /* adjust to your header image height */
    background: url("${bgUrl}") no-repeat center top;
    background-size: contain;
  }
  .content {
    padding: 20px 40px;
    color: #000;
  }
  .main-title {
    font-size: 32px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 20px;
  }
  .meta {
    font-size: 16px;
    line-height: 1.5;
    margin-bottom: 20px;
  }
  .meta b { font-weight: bold; }
  .section-title {
    font-size: 18px;
    font-weight: bold;
    margin: 16px 0 8px 0;
  }
  .question { margin-bottom: 12px; }
  .options { margin-left: 20px; margin-top: 6px; }
  .option { margin-bottom: 4px; }
  .correct { color: green; font-weight: 600; }
  .answer-block { margin-top: 6px; font-style: normal; }
  .case-study { margin-top: 12px; padding: 8px; border-left: 3px solid #ddd; background: rgba(255,255,255,0.8); }
  .footer {
    position: absolute;
    bottom: 40px;
    width: 100%;
    text-align: center;
    font-size: 14px;
    color: #444;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="header"></div>
    <div class="content">
      <div class="main-title">${escapeHtml(title)}</div>
      <div class="meta">
        <div><b>Intern Name:</b> ${escapeHtml(userName||"")}</div>
        <div><b>Domain:</b> ${escapeHtml(domainName||"")}</div>
        <div><b>Course:</b> ${escapeHtml(courseName||"")}</div>
        <div><b>Session:</b> Session ${escapeHtml(String(sessionNumber||""))} ${sessionTitle ? "– " + escapeHtml(sessionTitle) : ""}</div>
        <div><b>Video Duration:</b> ${escapeHtml(sessionDuration||"")}</div>
        <div><b>Start Date:</b> ${escapeHtml(formatDateReadable(startDate))} <b>End Date:</b> ${escapeHtml(formatDateReadable(endDate))}</div>
      </div>

      <div class="section-title">1. MCQ Quiz – Session ${escapeHtml(String(sessionNumber||""))}</div>
      ${mcqs.length
        ? mcqs.map((q, idx) => {
            const opts = Array.isArray(q.options) ? q.options : [];
            const correct = q.correctAnswer || "";
            return `<div class="question">
              <div><b>Question ${idx+1}:</b> ${escapeHtml(q.question || `Question ${idx+1}`)}</div>
              <div class="options">
                ${opts.map((opt,j)=>`<div class="option">${j+1}. ${escapeHtml(opt)}${opt==correct? ' <span class="correct">(Correct)</span>': ''}</div>`).join('')}
              </div>
              <div class="answer-block"><b>Answer:</b> ${escapeHtml(correct)}</div>
            </div>`;
          }).join('')
        : `<div><i>No MCQ data available.</i></div>`}

      ${caseStudyResult
        ? `<div class="case-study">
             <div class="section-title">2. Case Study</div>
             <div><b>Match Percentage:</b> ${escapeHtml(String(caseStudyResult.matchPercentage||""))}%</div>
             ${caseStudyResult.summary ? `<div><b>Summary:</b> ${escapeHtml(caseStudyResult.summary)}</div>` : ""}
           </div>`
        : ""}
    </div>
    <div class="footer">Generated on ${today}</div>
  </div>
</body>
</html>
`;

  // Puppeteer PDF generation
  const browser = await puppeteer.launch({ headless:true, args:["--no-sandbox","--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.evaluateHandle("document.fonts.ready");
  await new Promise(r => setTimeout(r, 500));

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" },
  });

  await page.close();
  await browser.close();

  // Upload to S3
  const safeCourseId = courseId ? String(courseId) : "generic";
  const fileName = `session-${day || "d"}-s${sessionNumber || "0"}.pdf`;
  const s3KeyPrefix = options.bucketPrefix || `internshipReports/${userId}/course-${safeCourseId}`;
  const s3Key = `${s3KeyPrefix}/${fileName}`;

  await s3.putObject({
    Bucket: "fundsweb",
    Key: s3Key,
    Body: pdfBuffer,
    ContentType: "application/pdf"
  }).promise();

  return { fileName, fileUrl: `https://fundsweb.s3.ap-south-1.amazonaws.com/${s3Key}`, s3Key };
};

module.exports = { generateSessionReport };
