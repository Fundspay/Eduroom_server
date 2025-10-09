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
 */
const fetchSessions = async () => {
  if (!model.CourseDetail)
    throw new Error("Sequelize model 'CourseDetail' not found");

  const sessionsFromDB = await model.CourseDetail.findAll({
    where: { courseId: 8, isDeleted: false }, // ✅ Added isDeleted filter
    attributes: ["day", "title"],
    order: [["day", "ASC"], ["id", "ASC"]],
    raw: true, // ✅ Get plain objects
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
  let sessions =
    Array.isArray(sessionData) && sessionData.length
      ? sessionData
      : await fetchSessions();

  const bgUrl = options.bgUrl || `${ASSET_BASE}/internshipbg.png`;
  const title = "Internship Report – Table of Contents";
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Generate table rows
  const tocRows = sessions
    .map((s) =>
      s.sessionTitles
        .map(
          (sessionTitle, idx) => `
        <tr>
          <td style="text-align:center;">${s.day}.${idx + 1}</td>
          <td>${escapeHtml(sessionTitle)}</td>
          <td></td>
        </tr>
      `
        )
        .join("")
    )
    .join("");

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
  .content {
    background: rgba(255,255,255,0.85);
    margin:180px 40px 80px 40px;
    padding:40px;
    border-radius:8px;
    box-sizing:border-box;
  }
  .main-title { font-size:32px; font-weight:bold; text-align:center; margin-bottom:20px; }
  .section-title { font-size:18px; font-weight:bold; margin:16px 0 8px 0; }
  .toc-table th { background-color: #f0f0f0; font-weight: bold; }
  .toc-table td, .toc-table th { border: 1px solid #000; padding:6px; }
</style>
</head>
<body>
  <div class="page">
    <div class="content">
      <div class="main-title">${escapeHtml(title)}</div>
      <div class="section-title">Table of Contents</div>
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
    <div class="footer" style="position:absolute; bottom:30px; width:100%; text-align:center; font-size:14px; color:#444;">
      Generated on ${today}
    </div>
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
  await new Promise((r) => setTimeout(r, 500));

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" },
  });

  await page.close();
  await browser.close();

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
