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

// Asset base URL for S3 images
const ASSET_BASE = "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets";

const normalizeDateToISO = (input) => {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d)) return null;
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
};

const generateOfferLetter = async (userId) => {
  if (!userId) throw new Error("Missing userId");

  // 1. Load user
  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false }
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
        const entryISO = normalizeDateToISO(dateVal) || (typeof dateVal === "string" ? dateVal.trim() : null);
        if (!entryISO) continue;
        if (entryISO === prefISO) {
          matchedCourseId = cid;
          break;
        }
      }

      if (matchedCourseId != null) {
        const courseWhereId = isNaN(Number(matchedCourseId)) ? matchedCourseId : Number(matchedCourseId);

        if (courseWhereId !== undefined && courseWhereId !== null) {
          const course = await model.Course.findOne({ where: { id: courseWhereId } });
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
  const position = courseName || user.course || user.internshipProgram || "Intern";

  // 4. Format start date
  const startDate = user.preferredStartDate
    ? new Date(user.preferredStartDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric"
      })
    : "To Be Decided";
  const workLocation = user.residentialAddress || "Work from Home";

  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  // 5) HTML content (your CSS untouched, only background path fixed)
  const html = `
<!DOCTYPE html>
<html lang="en">
 
<head>
    <meta charset="UTF-8">
    <title>Offer Letter</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: "Times New Roman", serif;
            background: #f5f5f5;
        }
 
        .letter-container {
            width: 800px;
            margin: 20px auto;
            padding: 80px 100px;
            background: url("${ASSET_BASE}/offerbg.png") no-repeat center top;
            background-size: cover;
            min-height: 1100px;
            box-sizing: border-box;
            position: relative;
        }
 
        /* Load TeX Gyre Bonum font (if hosted locally) */
        @font-face {
            font-family: 'TeX Gyre Bonum';
            src: url('fonts/texgyrebonum.woff2') format('woff2'),
                url('fonts/texgyrebonum.woff') format('woff'),
                url('fonts/texgyrebonum.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
        }
 
        /* Apply font to all your classes */
        .date,
        .title,
        .content {
            font-family: 'TeX Gyre Bonum', 'Times New Roman', serif;
        }
 
        .date {
            text-align: left;
            margin-top: 100px;
            margin-bottom: 87px;
            margin-left: -65px;
            font-size: 16px;
        }
 
        .title {
            text-align: center;
            font-weight: bold;
            margin-left: -65px;
            font-size: 20px;
            margin-bottom: 40px;
            text-transform: uppercase;
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
 
        .signature img {
            height: 60px;
            display: block;
            margin-top: 10px;
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
            Dear <b>${candidateName}</b>,<br><br>
 
            Congratulations! We are pleased to confirm that you have been selected for the role of <b>${position}</b> at Eduroom. We believe that your skills, experience, and qualifications make you an excellent fit for this role.
            <br><br>
            <b>Starting Date:</b> ${startDate}<br>
            <b>Position:</b> ${position}<br>
            <b>Work Location:</b> ${workLocation}<br>
            <b>Benefits:</b> Certification of Internship and LOA (performance-based).<br><br>
 
            We eagerly anticipate welcoming you to our team and embarking on this journey together. Your talents and expertise will enrich our collaborative efforts as we work towards our shared goals. We are excited about the opportunity to leverage your skills and contributions to drive our company's success.
        </div>
    </div>
</body>
</html>
`;

  // 6) Render PDF with Puppeteer
  let pdfBuffer;
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluateHandle("document.fonts.ready");

    pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
    });

    await browser.close();
  } catch (err) {
    throw new Error("PDF generation failed: " + err.message);
  }

  // 7) Upload PDF to S3 (no ACL, since bucket policy handles public access)
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

module.exports = { generateOfferLetter };
