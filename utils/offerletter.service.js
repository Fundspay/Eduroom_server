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

const normalizeDateToISO = (input) => {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d)) return null;
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
};

const formatDateOrdinal = (date) => {
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

const generateOfferLetter = async (userId) => {
  if (!userId) throw new Error("Missing userId");

  // 1. Load user
  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false },
  });
  if (!user) throw new Error("User not found");

  const candidateName = user.fullName || `${user.firstName} ${user.lastName}`;

  // 2. Determine position from courseDates -> Course model
  let courseName = null;

  try {
    const prefRaw = user.preferredStartDate; // e.g. "2025-09-12"
    const prefISO = normalizeDateToISO(prefRaw);

    if (prefISO && user.courseDates && Object.keys(user.courseDates).length > 0) {
      let matchedCourseId = null;

      for (const [cid, dateVal] of Object.entries(user.courseDates)) {
        if (!dateVal) continue;
        const entryISO =
          normalizeDateToISO(dateVal) ||
          (typeof dateVal === "string" ? dateVal.trim() : null);
        if (!entryISO) continue;
        if (entryISO === prefISO) {
          matchedCourseId = cid;
          break;
        }
      }

      if (matchedCourseId != null) {
        const courseWhereId = isNaN(Number(matchedCourseId))
          ? matchedCourseId
          : Number(matchedCourseId);

        if (courseWhereId !== undefined && courseWhereId !== null) {
          const course = await model.Course.findOne({
            where: { id: courseWhereId },
          });
          if (course && course.name) {
            courseName = course.name;
          }
        }
      }
    }
  } catch (err) {
    console.warn("Could not resolve course from courseDates:", err.message);
  }

  // 3. Fallback position
  const position =
    courseName || user.course || user.internshipProgram || "Intern";

  // 4. Format start date for text
  const today = formatDateOrdinal(new Date());

  // 5. HTML with <img> as background
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Certificate</title>
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
      margin: 20px auto;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }

    .bg-img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 0;
    }

    .certificate .name {
      position: absolute;
      top: 290px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 98px;
      font-family: "Brush Script MT", cursive;
      color: #b08d2e;
      z-index: 1;
    }

    .certificate .description {
      position: absolute;
      top: 420px;
      left: 50%;
      transform: translateX(-50%);
      width: 70%;
      font-size: 18px;
      text-align: center;
      color: #004225;
      line-height: 1.5em;
      font-family: 'Poppins', sans-serif;
      z-index: 1;
    }

    .certificate .date {
      position: absolute;
      bottom: 190px;
      left: 630px;
      font-size: 18px;
      font-weight: bold;
      color: #004225;
      z-index: 1;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <img src="https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/background.png" class="bg-img" />
    <div class="name">${candidateName}</div>
    <div class="description">
      In appreciation of his/her exceptional achievements and<br/>
      contributions in ${position}, which have greatly enhanced the<br/>
      values of Eduroom
    </div>
    <div class="date">${today}</div>
  </div>
</body>
</html>
`;

  // 6. Render PDF
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.waitForSelector(".certificate"); // ensure background loads

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
  });

  await browser.close();

  // 7. Upload to S3
  const timestamp = Date.now();
  const fileName = `offerletter-${timestamp}.pdf`;
  const s3Key = `offerletters/${userId}/${fileName}`;

  await s3
    .putObject({
      Bucket: "fundsweb",
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: "application/pdf"
    })
    .promise();

  return {
    fileName,
    fileUrl: `https://fundsweb.s3.ap-south-1.amazonaws.com/${s3Key}`,
  };
};

module.exports = { generateOfferLetter };
