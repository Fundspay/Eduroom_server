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

const normalizeDateToISO = (input) => {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d)) return null;
  return d.toISOString().split("T")[0];
};

// ---------- GENERATE OFFER LETTER ----------
const generateOfferLetterFundsWeb = async (userId, courseId = null) => {
  if (!userId) throw new Error("Missing userId");

  // 1. Load user
  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false }
  });

  if (!user) throw new Error("User not found");

  const candidateName = user.fullName || `${user.firstName} ${user.lastName}`;

  // 2. Determine course details
  let startDate = null;
  let courseName = null;

  if (user.courseDates && Object.keys(user.courseDates).length > 0) {
    let targetCourseId = null;

    if (courseId) {
      if (user.courseDates[courseId] && user.courseDates[courseId].startDate) {
        targetCourseId = courseId;
      }
    } else {
      let earliestStart = null;

      for (const [cid, courseObj] of Object.entries(user.courseDates)) {
        if (!courseObj.startDate) continue;

        const courseStartISO = normalizeDateToISO(courseObj.startDate);
        if (!courseStartISO) continue;

        if (!earliestStart || new Date(courseStartISO) < new Date(earliestStart)) {
          earliestStart = courseStartISO;
          targetCourseId = cid;
        }
      }
    }

    if (targetCourseId) {
      const courseObj = user.courseDates[targetCourseId];
      startDate = normalizeDateToISO(courseObj.startDate);

      const course = await model.Course.findOne({
        where: { id: Number(targetCourseId) }
      });

      if (course && course.name) {
        courseName = course.name;
      }
    }
  }

  startDate = startDate
    ? new Date(startDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    })
    : "To Be Decided";

  const position = courseName || "Business Development Intern";
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  // 3. HTML content
  const html = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Offer Letter</title>

    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Times New Roman', serif;
            background: #f5f5f5;
        }

        .letter-container {
            width: 800px;
            margin: 0 auto;
            padding: 70px 95px 30px 95px;
            background: url("https://1fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/1.png") no-repeat center top;
            background-size: cover;
            height: 1120px;
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
        }

        .date,
        .content {
            font-family: 'Times New Roman', serif;
        }

        .date {
            text-align: left;
            margin-top: 105px;
            margin-bottom: 14px;
            margin-left: -55px;
            font-size: 14px;
        }

        .content {
            font-size: 12.5px;
            margin-left: -55px;
            line-height: 1.35;
            text-align: justify;
        }

        .section-title {
            font-weight: bold;
            margin-top: 10px;
            margin-bottom: 2px;
        }

        ul {
            margin-top: 2px;
            margin-bottom: 6px;
            padding-left: 18px;
        }

        li {
            margin-bottom: 2px;
        }

        p {
            margin: 0;
        }
    </style>
</head>

<body>

    <div class="letter-container">

        <div class="date">
            Date: <b>${today}</b>
        </div>

        <div class="content">

            Dear <b>${candidateName}</b>,<br><br>

            We are pleased to offer you the position of <b>${position}</b> at <b>Fundsroom Infotech Pvt Ltd</b>.<br><br>

            <div class="section-title">Joining Details</div>

            <ul>
                <li><b>Joining Date:</b> ${startDate}</li>
                <li><b>Duration:</b> 45-60 Days</li>
                <li><b>Work Mode:</b> Remote (Work From Home)</li>
                <li><b>Working Hours:</b> Flexible (Expected: 2 hours/day)</li>
            </ul>

            <div class="section-title">Roles & Responsibilities</div>

            During the internship, you will be required to:

            <ul>
                <li>Work on real-time projects related to your domain.</li>
                <li>Build and manage your own professional portfolio.</li>
                <li>Complete assigned training sessions, tasks, and case studies.</li>
                <li>Achieve business targets, such as onboarding users or promoting the fundsportfolio.</li>
                <li>Maintain daily performance reporting through the dashboard/system.</li>
            </ul>

            <div class="section-title">Stipend</div>

            <ul>
                <li>The Stipend is up to 7000/-* (Performance-Based).</li>
                <li>Incentives/earnings may be provided based on performance and target achievements (if applicable).</li>
            </ul>

            <div class="section-title">Terms & Conditions</div>

            <ul>
                <li>This is a training-based internship focused on skill development and real-world exposure.</li>
                <li>The company reserves the right to terminate the internship in case of non-performance or misconduct.</li>
                <li>Interns are expected to maintain professionalism and adhere to company guidelines.</li>
            </ul>

            We are excited to have you on board and look forward to your contributions and growth with us.<br><br>

            <b>Best Regards,</b>

        </div>

    </div>

</body>

</html>
`;

  // 4. PDF Rendering
  let browser;
  let page;
  let pdfBuffer;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--single-process",
        "--disable-gpu"
      ],
    });

    page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await page.evaluateHandle("document.fonts.ready");
    await new Promise(res => setTimeout(res, 500));

    pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0px",
        right: "0px",
        bottom: "0px",
        left: "0px"
      }
    });

  } catch (err) {
    throw new Error("PDF generation failed: " + err.message);
  } finally {
    if (page) await page.close().catch(() => { });
    if (browser) await browser.close().catch(() => { });
  }

  // 5. Upload to S3
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

module.exports = { generateOfferLetterFundsWeb };