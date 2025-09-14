"use strict";

const AWS = require("aws-sdk");
const puppeteer = require("puppeteer");
const CONFIG = require("../config/config");
const model = require("../models");

// Configure AWS S3 client
const s3 = new AWS.S3({
  accessKeyId: CONFIG.awsAccessKeyId,
  secretAccessKey: CONFIG.awsSecretAccessKey,
  region: CONFIG.awsRegion,
});

/**
 * Format date with ordinal suffix (e.g., "14th September 2025").
 */
const formatDateOrdinal = (date) => {
  if (!(date instanceof Date) || isNaN(date)) return "Invalid Date";
  const day = date.getDate();
  const month = date.toLocaleString("en-GB", { month: "long" });
  const year = date.getFullYear();

  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
      ? "nd"
      : day % 10 === 3 && day !== 13
      ? "rd"
      : "th";

  return `${day}${suffix} ${month} ${year}`;
};

/**
 * Generate an offer letter PDF for a given user and upload it to S3.
 */
const generateCourseLetter = async (userId) => {
  if (!userId) throw new Error("Missing userId");

  // 1) Load user
  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false },
  });
  if (!user) throw new Error("User not found");

  const candidateName =
    user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim();

  const position = user.course || user.internshipProgram || "Intern";
  const today = formatDateOrdinal(new Date());

  // 2) Asset base
  const ASSET_BASE =
    "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets";

  // 3) HTML content
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Offer Letter</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Times New Roman', serif;
      background: #f5f5f5;
    }
    .certificate {
      position: relative;
      width: 1086px;
      height: 768px;
      background: url("${ASSET_BASE}/backgroud.png") no-repeat center center;
      background-size: cover;
      margin: 20px auto;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }
    .certificate .name {
      position: absolute;
      top: 290px;
      left: 65%;
      transform: translateX(-50%);
      font-size: 98px;
      font-family: "Brush Script MT", cursive;
      color: #b08d2e;
    }
    .certificate .description {
      position: absolute;
      top: 420px;
      left: 65%;
      transform: translateX(-50%);
      width: 70%;
      font-size: 18px;
      text-align: center;
      color: #004225;
      line-height: 1.5em;
      font-family: 'Poppins', sans-serif;
    }
    .certificate .date {
      position: absolute;
      bottom: 190px;
      left: 660px;
      font-size: 18px;
      font-weight: bold;
      color: #004225;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="name">${candidateName}</div>
    <div class="description">
      In appreciation of his/her exceptional achievements and<br/>
      contributions in ${position}, which have greatly enhanced the<br/>
      values of Eduroom.
    </div>
    <div class="date">${today}</div>
  </div>
</body>
</html>
`;

  // 4) Render PDF with Puppeteer
  let pdfBuffer;
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluateHandle("document.fonts.ready"); // ensure fonts & bg load

    pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
    });

    await browser.close();
  } catch (err) {
    throw new Error("PDF generation failed: " + err.message);
  }

  // 5) Upload PDF to S3 (no ACL, since bucket policy handles public access)
  const timestamp = Date.now();
  const fileName = `offerletter-${timestamp}.pdf`;
  const s3Key = `offerletters/${userId}/${fileName}`;

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

module.exports = { generateCourseLetter };
