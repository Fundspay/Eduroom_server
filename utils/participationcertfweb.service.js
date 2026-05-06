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

const ASSET_BASE = "https://1fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets";

const normalizeDateToISO = (input) => {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d)) return null;
  return d.toISOString().split("T")[0];
};

const generateparticipationCertificate = async (userId, courseId) => {
  if (!userId) throw new Error("Missing userId");
  if (!courseId) throw new Error("Missing courseId");

  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false }
  });

  if (!user) throw new Error("User not found");

  const candidateName = user.fullName || `${user.firstName} ${user.lastName}`;

  let startDate = "To Be Decided";
  let endDate = "To Be Decided";

  if (user.courseDates && user.courseDates[courseId]) {
    const courseObj = user.courseDates[courseId];

    startDate = courseObj.startDate
      ? normalizeDateToISO(courseObj.startDate)
      : startDate;

    endDate = courseObj.endDate
      ? normalizeDateToISO(courseObj.endDate)
      : endDate;

    startDate = new Date(startDate).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    endDate = new Date(endDate).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  const backgroundImage =
    Number(courseId) === 24
      ? `${ASSET_BASE}/22.jpg`
      : `${ASSET_BASE}/22.jpg`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Certificate</title>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: 'Georgia', serif;
  background: #f5f5f5;
}

.container {
  width: 800px;
  height: 1100px;
  margin: 20px auto;
  background: url("${backgroundImage}") no-repeat center;
  background-size: cover;
  position: relative;
  box-sizing: border-box;
  padding: 60px 80px;
  text-align: center;
}

.logo {
  position: absolute;
  top: 40px;
  right: 60px;
  font-size: 18px;
  font-weight: bold;
  color: #2c2c54;
}

.title {
  margin-top: 120px;
  font-size: 48px;
  letter-spacing: 6px;
  font-weight: bold;
  color: #1e1e6d;
}

.subtitle {
  font-size: 18px;
  letter-spacing: 3px;
  margin-top: 10px;
  color: #444;
}

.award-text {
  margin-top: 60px;
  font-size: 16px;
  letter-spacing: 1px;
}

.name {
  margin-top: 30px;
  font-size: 42px;
  color: #333;
}

.desc {
  margin-top: 25px;
  font-size: 16px;
  color: #444;
}

.footer-left {
  position: absolute;
  bottom: 120px;
  left: 80px;
  font-size: 14px;
}

.footer-right {
  position: absolute;
  bottom: 120px;
  right: 80px;
  text-align: center;
  font-size: 14px;
}

.signature {
  margin-top: 10px;
  font-family: cursive;
  font-size: 20px;
}
</style>
</head>

<body>

<div class="container">

  <div class="logo">Fundsroom</div>

  <div class="title">CERTIFICATE</div>
  <div class="subtitle">OF PARTICIPATION</div>

  <div class="award-text">THE FOLLOWING AWARD IS GIVEN TO</div>

  <div class="name">${candidateName}</div>

  <div class="desc">
    for participation in the internship program from <b>${startDate}</b><br>
    to <b>${endDate}</b>.
  </div>

  <div class="footer-left">
    FUNDSWEB<br>
    CERTIFICATION
  </div>

  <div class="footer-right">
    <div class="signature">Divika</div>
    Ms. Iitika Paliwal<br>
    Jr. Branch Manager
  </div>

</div>

</body>
</html>
`;

  let pdfBuffer;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ],
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

  const timestamp = Date.now();
  const fileName = `offerletter-${timestamp}.pdf`;
  const s3Key = `offerletters/${userId}/${fileName}`;

  await s3.putObject({
    Bucket: "1fundsweb",
    Key: s3Key,
    Body: pdfBuffer,
    ContentType: "application/pdf",
  }).promise();

  return {
    fileName,
    fileUrl: `https://1fundsweb.s3.ap-south-1.amazonaws.com/${s3Key}`,
  };
};

module.exports = {generateparticipationCertificate };