"use strict";
const AWS = require("aws-sdk");
const puppeteer = require("puppeteer");
const QRCode = require("qrcode"); // npm install qrcode
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

/**
 * Generates a base64 PNG data URL for the given URL.
 * Returns null if no portfolioLink is set.
 */
const generateQRCodeDataURL = async (text) => {
  if (!text) return null;
  try {
    return await QRCode.toDataURL(text, {
      width: 120,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch {
    return null;
  }
};

const generateInternshipCertificateWeb = async (userId, courseId) => {
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
  let courseName = "Internship Program";

  if (user.courseDates && user.courseDates[courseId]) {
    const courseObj = user.courseDates[courseId];

    startDate = courseObj.startDate ? normalizeDateToISO(courseObj.startDate) : startDate;
    endDate = courseObj.endDate ? normalizeDateToISO(courseObj.endDate) : endDate;

    const course = await model.Course.findOne({ where: { id: Number(courseId) } });
    if (course && course.name) courseName = course.name;

    startDate = new Date(startDate).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric"
    });
    endDate = new Date(endDate).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric"
    });
  }

  const role = courseName;
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric"
  });

  // 4. Conditional background image
  const backgroundImage =
    Number(courseId) === 24
      ? "https://1fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/10.png"
      : "https://1fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/1.png";

  // 5. Generate QR code for portfolioLink (null if not set)
  const qrCodeDataURL = await generateQRCodeDataURL(user.portfolioLink);

  // 6. QR block HTML — only rendered when portfolioLink exists
  const qrBlockHTML = qrCodeDataURL
    ? `
      <div class="qr-block">
        <img src="${qrCodeDataURL}" alt="Portfolio QR Code" class="qr-image" />
        <p class="qr-label">Scan to view portfolio</p>
      </div>`
    : "";

  // 7. HTML template
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
            line-height: 1.8;
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

        ul {
            margin-top: 10px;
            margin-bottom: 20px;
            padding-left: 22px;
        }

        li {
            margin-bottom: 10px;
        }

        /* ── QR Code block ── */
        .qr-block {
            position: absolute;
            bottom: 80px;      /* sits just above the footer area */
            right: 100px;      /* aligns with the right padding of the container */
            text-align: center;
        }

        .qr-image {
            width: 110px;
            height: 110px;
            display: block;
            border: 1px solid #ccc;
            padding: 4px;
            background: #fff;
        }

        .qr-label {
            margin: 6px 0 0;
            font-size: 11px;
            color: #555;
            font-family: 'Times New Roman', serif;
        }
    </style>
</head>

<body>
    <div class="letter-container">

        <div class="date">
            Date: <b>${endDate}</b>
        </div>

        <div class="content">

            This is to certify that <b>${candidateName}</b> has successfully completed the
            <b>${role}</b> with <b>Fundsroom</b> from <b>${startDate}</b> to <b>${endDate}</b>.<br><br>

            During the internship, the participant demonstrated strong commitment and successfully:

            <ul>
                <li>Completed all assigned training sessions, assessments, and case studies.</li>
                <li>Performed practical tasks aligned with their domain (Finance / Marketing / Business Analytics).</li>
                <li>Built and managed a professional portfolio.</li>
                <li>Conducted analysis and understanding of real business cases and market scenarios.</li>
                <li>Successfully onboarded users/businesses/portfolios as part of the internship requirements.</li>
            </ul>

            The participant has shown excellent learning ability, execution skills, and a strong
            understanding of practical industry applications.<br><br>

            This certificate is awarded in recognition of their successful completion of all
            internship requirements and their overall performance.<br><br>

            We wish them continued success in their professional journey.<br><br>

            <b>Date:</b> ${today}<br><br>

            <b>Fundsroom Infotech Pvt. Ltd</b>

        </div>

        ${qrBlockHTML}

    </div>
</body>
</html>
`;

  // 8. Render PDF with Puppeteer
  let pdfBuffer;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluateHandle("document.fonts.ready");
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

  // 9. Upload to S3
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

module.exports = { generateInternshipCertificateWeb };