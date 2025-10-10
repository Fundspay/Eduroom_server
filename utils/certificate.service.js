"use strict";
const AWS = require("aws-sdk");
const puppeteer = require("puppeteer");
const CONFIG = require("../config/config");
const model = require("../models");

const s3 = new AWS.S3({
  accessKeyId: CONFIG.awsAccessKeyId,
  secretAccessKey: CONFIG.awsSecretAccessKey,
  region: CONFIG.awsRegion
});

const generateCertificate = async (userId) => {
  if (!userId) throw new Error("Missing userId");

  // 1. Load user
  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false }
  });
  if (!user) throw new Error("User not found");

  const candidateName = user.fullName || `${user.firstName} ${user.lastName}`;

  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  // 2. HTML content for certificate
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Certificate of Completion</title>
<style>
  body {
    margin: 0;
    padding: 0;
    font-family: 'Times New Roman', serif;
    background: #f9f9f9;
  }
  .certificate-container {
    width: 900px;
    margin: 50px auto;
    padding: 80px 100px;
    background: url("https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/4.png") no-repeat center top;
    background-size: cover;
    min-height: 1200px;
    box-sizing: border-box;
    position: relative;
  }
  .title {
    text-align: center;
    font-size: 28px;
    font-weight: bold;
    margin-bottom: 50px;
    text-transform: uppercase;
  }
  .content {
    font-size: 18px;
    line-height: 1.8;
    text-align: justify;
    margin: 0 50px;
  }
  .candidate-name {
    text-align: center;
    font-size: 24px;
    font-weight: bold;
    margin: 30px 0;
  }
  .date {
    text-align: right;
    margin-top: 80px;
    font-size: 16px;
  }
  .footer {
    text-align: center;
    position: absolute;
    bottom: 50px;
    left: 0;
    right: 0;
    font-size: 14px;
    color: #333;
  }
</style>
</head>
<body>
<div class="certificate-container">
  <div class="title">Certificate of Completion</div>
  <div class="content">
    This is to certify that
  </div>
  <div class="candidate-name">${candidateName}</div>
  <div class="content">
    has successfully completed Module 1 of the Live Project on Customer Onboarding.<br><br>
    The candidate has actively participated in all onboarding activities, demonstrating a clear understanding of customer engagement processes, essential procedures, and best practices required for effective onboarding. Through consistent effort and commitment, ${candidateName} has acquired the foundational skills necessary to contribute effectively to customer onboarding initiatives and ensure a smooth, professional experience for clients.<br><br>
    We hereby acknowledge and commend the candidate’s successful completion of this module and their readiness to progress to further stages of the live project.
  </div>
  <div class="date">Date: <b>${today}</b></div>
</div>
</body>
</html>
`;

  // 3. Render PDF with Puppeteer
  let pdfBuffer;
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluateHandle('document.fonts.ready');
    await new Promise(resolve => setTimeout(resolve, 500));

    pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
    });

    await browser.close();
  } catch (err) {
    throw new Error("PDF generation failed: " + err.message);
  }

  // 4. Upload PDF to S3
  const timestamp = Date.now();
  const fileName = `certificate-${timestamp}.pdf`;
  const s3Key = `certificates/${userId}/${fileName}`;

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

module.exports. generateCertificate = generateCertificate 
