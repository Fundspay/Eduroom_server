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
 * Fetch sessions from DB grouped by day
 * @param {number} courseId - dynamic courseId
 */
const fetchSessions = async (courseId) => {
  if (!model.CourseDetail)
    throw new Error("Sequelize model 'CourseDetail' not found");

  if (!courseId) throw new Error("Missing courseId");

  const sessionsFromDB = await model.CourseDetail.findAll({
    where: { courseId, isDeleted: false }, // ✅ dynamic courseId
    attributes: ["day", "title"],
    order: [["day", "ASC"], ["id", "ASC"]],
    raw: true,
  });

  console.log("sessionsFromDB:", sessionsFromDB.length, sessionsFromDB);

  // Group titles by day
  const sessionsMap = {};
  sessionsFromDB.forEach((s) => {
    if (!sessionsMap[s.day]) sessionsMap[s.day] = [];
    sessionsMap[s.day].push(s.title);
  });

  // Convert to array for PDF generation
  const sessions = Object.keys(sessionsMap)
    .sort((a, b) => a - b)
    .map((day) => ({
      day,
      sessionTitles: sessionsMap[day],
    }));

  return sessions;
};

const generateSessionReport = async (sessionData = {}, options = {}) => {
 const courseId = Number(options.courseId);
  let sessions =
    Array.isArray(sessionData) && sessionData.length
      ? sessionData
      : await fetchSessions(courseId); // ✅ pass courseId dynamically

  const bgUrl = options.bgUrl || `${ASSET_BASE}/internshipbg.png`;
  const title = "Internship Report – Table of Contents";
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // 🔹 Split sessions into pages (10 sessions per page)
  const sessionsPerPage = 10;
  const pages = [];
  for (let i = 0; i < sessions.length; i += sessionsPerPage) {
    pages.push(sessions.slice(i, i + sessionsPerPage));
  }

  // 🔹 Generate each page HTML
  const pageHtml = pages
    .map((pageSessions, pageIndex) => {
      const tocRows = pageSessions
        .map((s, idx) => {
          const srNo = pageIndex * sessionsPerPage + (idx + 1);
          const topics = s.sessionTitles
            .map((t) => `<div>${escapeHtml(t)}</div>`)
            .join("");
          return `
            <tr>
              <td style="text-align:center;">${srNo}</td>
              <td>Session ${s.day}</td>
              <td>${topics}</td>
            </tr>
          `;
        })
        .join("");

      return `
      <div class="page">
        <div class="content">
          <div class="main-title">${escapeHtml(title)}</div>
          <table class="toc-table" border="1" cellspacing="0" cellpadding="6" style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr>
                <th style="width:10%; text-align:center;">Sr No</th>
                <th style="width:30%; text-align:left;">Session</th>
                <th style="width:60%; text-align:left;">Topics</th>
              </tr>
            </thead>
            <tbody>
              ${
                tocRows ||
                `<tr><td colspan="3" style="text-align:center;"><i>No sessions available</i></td></tr>`
              }
            </tbody>
          </table>
        </div>
        <div class="footer" style="position:absolute; bottom:10px; width:100%; text-align:center; font-size:14px; color:#444;">
          Generated on ${today}
        </div>
      </div>`;
    })
    .join("<div style='page-break-after: always;'></div>");

  // 🔹 Full HTML document with all pages
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
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
  /* 🔹 Adjusted spacing to move content upward */
  .content {
    background: rgba(255,255,255,0.85);
    margin:135px 40px 60px 40px; /* reduced from 180px top to 120px */
    padding:30px 40px;
    border-radius:8px;
    box-sizing:border-box;
  }
  .main-title { font-size:28px; font-weight:bold; text-align:center; margin-bottom:12px; }
  .section-title { font-size:18px; font-weight:bold; margin:12px 0 6px 0; }
  .toc-table th { background-color: #f0f0f0; font-weight: bold; }
  .toc-table td, .toc-table th { border: 1px solid #000; padding:6px; vertical-align: top; }
</style>
</head>
<body>
  ${pageHtml}
</body>
</html>
`;

  // 🔹 Generate PDF
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

  // 🔹 Upload to S3
  const s3KeyPrefix = options.bucketPrefix || `internshipReports/toc`;
  const s3Key = `${s3KeyPrefix}/table-of-contents.pdf`;

  await s3
    .putObject({
      Bucket: "fundsweb",
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
    .promise();

  return {
    fileName: "table-of-contents.pdf",
    fileUrl: `https://fundsweb.s3.ap-south-1.amazonaws.com/${s3Key}`,
    s3Key,
  };
};

module.exports = { generateSessionReport };
