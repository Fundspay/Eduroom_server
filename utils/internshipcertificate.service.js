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
  return d.toISOString().split("T")[0];
};

const generateInternshipCertificate = async (userId, courseId) => {
  if (!userId) throw new Error("Missing userId");
  if (!courseId) throw new Error("Missing courseId");

  // 1. Load user
  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false }
  });
  if (!user) throw new Error("User not found");

  const candidateName = user.fullName || `${user.firstName} ${user.lastName}`;

  // 2. Pronouns
  const genderVal = String(user.gender);
  let pronouns = { subject: "They", object: "them", possessive: "their" };
  if (genderVal === "1") pronouns = { subject: "He", object: "him", possessive: "his" };
  if (genderVal === "2") pronouns = { subject: "She", object: "her", possessive: "her" };

  // 3. Start + End Dates + Course details
  let startDate = "To Be Decided";
  let endDate = "To Be Decided";
  let courseName = "Intern";
  let domainSkills = [];
  let interpersonalSkills = [];

  if (user.courseDates && user.courseDates[courseId]) {
    const courseObj = user.courseDates[courseId];
    startDate = courseObj.startDate ? normalizeDateToISO(courseObj.startDate) : startDate;
    endDate = courseObj.endDate ? normalizeDateToISO(courseObj.endDate) : endDate;

    const course = await model.Course.findOne({ where: { id: Number(courseId) } });
    if (course) {
      if (course.name) courseName = course.name;
      domainSkills = course.domainSkills ? course.domainSkills.split(",").map(s => s.trim()) : [];
      interpersonalSkills = course.interpersonalSkills ? course.interpersonalSkills.split(",").map(s => s.trim()) : [];
    }

    startDate = new Date(startDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    endDate = new Date(endDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  const role = courseName;
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  // ✅ CONDITIONAL BACKGROUND IMAGE
  const backgroundImage =
    Number(courseId) === 24
      ? "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/10.png"
      : "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/9.png";

  // 5) HTML
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
             background: url("${backgroundImage}") no-repeat center top;
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
    <b>To Whom so ever it may concern</b>,<br><br>
    We are pleased to confirm that <b>${candidateName}</b> has successfully completed ${pronouns.possessive} role as an <b>${role}</b> Intern and completed ${pronouns.possessive} internship starting from <b>${startDate}</b> till <b>${endDate}</b>.<br><br>

    During ${pronouns.possessive} internship at Eduroom, ${pronouns.subject.toLowerCase()} demonstrated key traits like <b>${interpersonalSkills.join(", ")}</b>. ${pronouns.subject} demonstrated exceptional skills in <b>${domainSkills.join(", ")}</b>.<br><br>

    ${pronouns.possessive.charAt(0).toUpperCase() + pronouns.possessive.slice(1)} contributions have supported to overall business and organisational development. We wish ${pronouns.object} all the best in ${pronouns.possessive} future endeavours.<br><br>

    We also firmly believe ${pronouns.subject.toLowerCase()} will become an integral part of a future workplace.<br><br>
</div>

     </div>
 </body>
 </html>
 `;

  // 5) Render PDF
  let pdfBuffer;
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
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

  // Upload to S3
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
