"use strict";

const AWS = require("aws-sdk");
const puppeteer = require("puppeteer");
const CONFIG = require("../config/config");
const fs = require("fs");
const path = require("path");

const s3 = new AWS.S3({
  accessKeyId: CONFIG.awsAccessKeyId,
  secretAccessKey: CONFIG.awsSecretAccessKey,
  region: CONFIG.awsRegion,
});

const ASSET_BASE = CONFIG.assetBase || "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets";

// Load and convert default background image to Base64 (synchronously at startup)
let BASE64_BG = "";
try {
  const bgPath = path.join(__dirname, "../assets/internshipbg.png"); // local fallback
  const bgData = fs.readFileSync(bgPath);
  BASE64_BG = `data:image/png;base64,${bgData.toString("base64")}`;
} catch (err) {
  BASE64_BG = ""; // fallback to empty
}

const escapeHtml = (str) => {
  if (str === null || typeof str === "undefined") return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

const formatDateReadable = (input) => {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/**
 * Generate single session report PDF and upload to S3
 * @param {Object} sessionData - Session details
 * @param {Object} options - Options like bucketPrefix
 * @param {puppeteer.Browser} browserInstance - Optional Puppeteer browser instance for reuse
 */
const generateSessionReport = async (sessionData = {}, options = {}, browserInstance = null) => {
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

  const bgUrl = BASE64_BG || options.bgUrl || ""; // Inline Base64 background
  const title = `${courseName || ""} Internship Report – Session ${sessionNumber}`;

  // Build HTML
  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 20mm 15mm; }
      html, body { margin:0; padding:0; font-family: "Times New Roman", serif; color: #222; }
      body { background: #fff; }
      .page {
        position: relative;
        min-height: 100%;
        box-sizing: border-box;
        padding: 12mm;
        background-image: url("${bgUrl}");
        background-repeat: no-repeat;
        background-position: center top;
        background-size: cover;
      }
      .main-title { font-size: 20px; font-weight: 700; margin: 8px 0 12px 0; }
      .meta { font-size: 14px; line-height: 1.6; margin-bottom: 12px; }
      .meta b { font-weight: 700; }
      hr { border: none; border-top: 1px solid #cfcfcf; margin: 12px 0; }
      h3.section-title { font-size: 16px; margin: 8px 0; }
      .question { margin: 8px 0; }
      .options { margin-left: 20px; margin-top: 6px; }
      .option { margin: 4px 0; }
      .correct { color: green; font-weight: 600; }
      .answer-block { margin-top: 6px; font-style: normal; }
      .case-study { margin-top: 12px; padding: 8px; border-left: 3px solid #ddd; background: rgba(255,255,255,0.8); }
      .footer { position: absolute; bottom: 6mm; left: 12mm; right: 12mm; text-align: center; font-size: 11px; color: #666; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="main-title">${escapeHtml(title)}</div>
      <div class="meta">
        <div><b>Intern Name:</b> ${escapeHtml(userName || "")}</div>
        <div><b>Domain:</b> ${escapeHtml(domainName || "")}</div>
        <div><b>Course:</b> ${escapeHtml(courseName || "")}</div>
        <div><b>Session:</b> Session ${escapeHtml(String(sessionNumber || ""))} ${sessionTitle ? "– " + escapeHtml(sessionTitle) : ""}</div>
        <div><b>Video Duration:</b> ${escapeHtml(sessionDuration || "")}</div>
        <div><b>Start Date:</b> ${escapeHtml(formatDateReadable(startDate))} &nbsp;&nbsp; <b>End Date:</b> ${escapeHtml(formatDateReadable(endDate))}</div>
      </div>
      <hr />
      <div>
        <h3 class="section-title">1. MCQ Quiz – Session ${escapeHtml(String(sessionNumber || ""))}</h3>
        ${mcqs.length
          ? mcqs.map((q, idx) => {
              const qText = escapeHtml(q.question || `Question ${idx + 1}`);
              const opts = Array.isArray(q.options) ? q.options : [];
              const correct = q.correctAnswer || q.correct || "";
              return `
                <div class="question">
                  <div><b>Question ${idx + 1}:</b> ${qText}</div>
                  <div class="options">
                    ${opts.map((opt, j) => {
                      const optText = escapeHtml(opt || "");
                      const isCorrect = String(opt).trim() === String(correct).trim();
                      return `<div class="option">${j + 1}. ${optText}${isCorrect ? ' <span class="correct"> (Correct)</span>' : ''}</div>`;
                    }).join("")}
                  </div>
                  <div class="answer-block"><b>Answer:</b> ${escapeHtml(correct)}</div>
                </div>`;
            }).join("\n")
          : `<div><i>No MCQ data available for this session.</i></div>`}
      </div>
      ${caseStudyResult ? `
        <div class="case-study">
          <h3 class="section-title">2. Case Study</h3>
          <div><b>Match Percentage:</b> ${escapeHtml(String(caseStudyResult.matchPercentage || ""))}%</div>
          ${caseStudyResult.summary ? `<div style="margin-top:6px;"><b>Summary:</b> ${escapeHtml(caseStudyResult.summary)}</div>` : ""}
        </div>
      ` : ""}
      <div class="footer">Generated by FundsWeb · ${escapeHtml(new Date().toLocaleDateString("en-GB"))}</div>
    </div>
  </body>
  </html>
  `;

  // PDF generation with request interception & retries
  const generatePdfBuffer = async (htmlContent) => {
    const maxRetries = 2;
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const browser = browserInstance || await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
        const page = await browser.newPage();

        page.setDefaultNavigationTimeout(60000);
        page.setDefaultTimeout(60000);

        // Block all network requests except data URLs
        await page.setRequestInterception(true);
        page.on("request", (req) => {
          if (req.url().startsWith("data:") || req.resourceType() === "document") req.continue();
          else req.abort();
        });

        await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
        await page.evaluateHandle("document.fonts.ready");
        await new Promise(r => setTimeout(r, 500));

        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "15mm", bottom: "20mm", left: "12mm", right: "12mm" },
        });

        await page.close();
        if (!browserInstance) await browser.close();

        return pdfBuffer;
      } catch (err) {
        attempt++;
        if (attempt > maxRetries) throw new Error("PDF generation failed: " + err.message);
      }
    }
  };

  const pdfBuffer = await generatePdfBuffer(html);

  // S3 upload
  const safeCourseId = courseId ? String(courseId) : "generic";
  const fileName = `session-${day || "d"}-s${sessionNumber || "0"}.pdf`;
  const s3KeyPrefix = options.bucketPrefix || `internshipReports/${userId}/course-${safeCourseId}`;
  const s3Key = `${s3KeyPrefix}/${fileName}`;

  await s3.putObject({
    Bucket: "fundsweb",
    Key: s3Key,
    Body: pdfBuffer,
    ContentType: "application/pdf",
  }).promise();

  return {
    fileName,
    fileUrl: `https://fundsweb.s3.ap-south-1.amazonaws.com/${s3Key}`,
    s3Key,
  };
};

module.exports = { generateSessionReport };
