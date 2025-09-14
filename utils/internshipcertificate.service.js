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

const ASSET_BASE = "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets";

const normalizeDateToISO = (input) => {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d)) return null;
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
};

const  generateInternshipCertificate = async (userId) => {
  if (!userId) throw new Error("Missing userId");

  // 1. Load user
  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false }
  });
  if (!user) throw new Error("User not found");

  const candidateName = user.fullName || `${user.firstName} ${user.lastName}`;

  // 2. Determine the earliest course start date and corresponding end date from courseDates
  let startDate = null;
  let endDate = null;
  let courseName = null;

  if (user.courseDates && Object.keys(user.courseDates).length > 0) {
    let earliestStart = null;
    let courseIdForStart = null;

    for (const [cid, courseObj] of Object.entries(user.courseDates)) {
      if (!courseObj.startDate) continue;
      const courseStartISO = normalizeDateToISO(courseObj.startDate);
      if (!courseStartISO) continue;

      if (!earliestStart || new Date(courseStartISO) < new Date(earliestStart)) {
        earliestStart = courseStartISO;
        courseIdForStart = cid;
      }
    }

    startDate = earliestStart;

    if (courseIdForStart) {
      const course = await model.Course.findOne({ where: { id: Number(courseIdForStart) } });
      if (course && course.name) {
        courseName = course.name;
      }

      // Set endDate from the same course
      const selectedCourseObj = user.courseDates[courseIdForStart];
      if (selectedCourseObj.endDate) {
        endDate = normalizeDateToISO(selectedCourseObj.endDate);
      }
    }
  }

  // 3. Fallback formatting
  startDate = startDate
    ? new Date(startDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric"
      })
    : "To Be Decided";

  endDate = endDate
    ? new Date(endDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric"
      })
    : "To Be Decided";

  const role = courseName || "Intern";

  // 4. Today’s date
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  // 5) HTML content (your CSS untouched, only background path fixed)
 // 5) HTML content (updated text)
const html = `
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Internship Completion Certificate</title>

    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Times New Roman', serif;
            background: #f5f5f5;
        }

        .letter-container {
            width: 800px;
            margin: 20px auto;
            padding: 80px 100px;
            background: url("https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/2.png") no-repeat center top;
            background-size: cover;
            min-height: 1100px;
            box-sizing: border-box;
            position: relative;
        }

        .date,
        .content {
            font-family: 'Times New Roman', serif;
        }

        .date {
            text-align: left;
            margin-top: 100px;
            margin-bottom: 87px;
            margin-left: -65px;
            font-size: 16px;
        }

        .content {
            font-size: 15.5px;
            margin-left: -65px;
            line-height: 1.6;
            text-align: justify;
        }

        .signature {
            margin-top: 60px;
            font-size: 16px;
        }

        .footer {
            position: absolute;
            bottom: 30px;
            left: 100px;
            right: 100px;
            text-align: center;
            font-size: 14px;
            color: #333;
        }
    </style>
</head>

<body>
    <div class="letter-container">
        <div class="date">Date: <b>${today}</b></div>

        <div class="content">
            To <b>${candidateName}</b>,<br><br>

            We are pleased to confirm that ${candidateName} has successfully undertaken her role as a <b>${role}</b> and completed her internship starting from <b>${startDate}</b> to <b>${endDate}</b>.<br><br>

            During her internship at Eduroom, she demonstrated key traits like obedience, leadership, and strong communication skills, creating a positive and productive work environment. She demonstrated exceptional skills in market research, data analysis, and the interpretation of marketing metrics.<br><br>

            Her contributions have supported our marketing efforts and strategic initiatives and contributed immensely to business development.<br><br>

            We wish her the best of luck in her future endeavors and firmly believe she will become an integral part of a future workplace.
        </div>
    </div>
</body>

</html>
`;

  // 5) Render PDF with Puppeteer
  let pdfBuffer;
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });

    // Wait until fonts are fully loaded
    await page.evaluateHandle('document.fonts.ready');
    await new Promise(resolve => setTimeout(resolve, 500)); // compatible with all Puppeteer versions

    pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
    });

    await browser.close();
  } catch (err) {
    throw new Error("PDF generation failed: " + err.message);
  }

  // 6) Upload PDF to S3
  const timestamp = Date.now();
  const fileName = `offerletter-${timestamp}.pdf`;
  const s3Key = `offerletters/${userId}/${fileName}`;

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

module.exports = { generateInternshipCertificate };