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

const ASSET_BASE = "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets";

const generateInternshipReport = async (userId) => {
   userId = Number(userId); 
  if (!userId) throw new Error("Missing userId");

  // 1️⃣ Load user details
  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false },
  });
  if (!user) throw new Error("User not found");

  const firstName = user.firstName || "";
  const lastName = user.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();

  // 2️⃣ Prepare date & content
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // 3️⃣ Build HTML for the Internship Report
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Internship Report</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Arial', sans-serif;
    }
    .page {
      width: 100%;
      height: 100vh;
      background: url("${ASSET_BASE}/internshipbg.png") no-repeat center top;
      background-size: cover;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: #000;
      text-align: center;
      padding: 100px 50px;
      box-sizing: border-box;
    }
    .title {
      font-size: 60px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .by {
      font-size: 26px;
      font-weight: bold;
      margin-top: 40px;
    }
    .name {
      font-size: 40px;
      color: red;
      font-weight: bold;
      margin-top: 10px;
    }
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
    <div class="title">INTERNSHIP REPORT</div>
    <div class="by">BY</div>
    <div class="name">${fullName}</div>
    <div class="footer">Generated on ${today}</div>
  </div>
</body>
</html>
`;

  // 4️⃣ Generate PDF using Puppeteer
  let pdfBuffer;
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluateHandle("document.fonts.ready");
    await new Promise((r) => setTimeout(r, 300));

    pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" },
    });
    await browser.close();
  } catch (err) {
    throw new Error("PDF generation failed: " + err.message);
  }

  // 5️⃣ Upload to S3
  const timestamp = Date.now();
  const fileName = `internship-report-${timestamp}.pdf`;
  const s3Key = `internshipReports/${userId}/${fileName}`;

  await s3
    .putObject({
      Bucket: "fundsweb",
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
    .promise();

  // 6️⃣ Return S3 file link
  return {
    fileName,
    fileUrl: `https://fundsweb.s3.ap-south-1.amazonaws.com/${s3Key}`,
  };
};

module.exports = { generateInternshipReport };
