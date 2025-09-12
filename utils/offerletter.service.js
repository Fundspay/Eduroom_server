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

const generateOfferLetter = async (userId) => {
  if (!userId) throw new Error("Missing userId");

  // 1) Load user
  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false },
  });
  if (!user) throw new Error("User not found");

  const candidateName =
    user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Candidate";
  const position = user.internshipProgram || "Intern";
  const startDate = user.preferredStartDate
    ? new Date(user.preferredStartDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "To Be Decided";
  const workLocation = user.residentialAddress || "Work from Home";

  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // 2) Asset base (put your bucket path here)
  const ASSET_BASE = "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets";
  const HEADER_H = 110; // px — adjust if your header image is taller/shorter
  const FOOTER_H = 120; // px — adjust if your footer image is taller/shorter

  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        html, body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body {
          font-family: Arial, sans-serif;
          margin: 0;                 /* we'll manage spacing with paddings to avoid overlap */
          font-size: 13px;
          line-height: 1.6;
        }

        /* Fixed header/footer images */
        .header-img {
          position: fixed;
          top: 0;
          left: 0; right: 0;
          width: 100%;
          height: ${HEADER_H}px;
          object-fit: cover;
          z-index: 1;
        }
        .footer-img {
          position: fixed;
          bottom: 0;
          left: 0; right: 0;
          width: 100%;
          height: ${FOOTER_H}px;
          object-fit: cover;
          z-index: 1;
        }

        /* Main content gets padded so it never touches header/footer images */
        .content {
          padding: ${HEADER_H + 20}px 60px ${FOOTER_H + 25}px 60px; /* top | right | bottom | left */
          position: relative;
          z-index: 2; /* ensure above header/footer if they have shapes */
        }

        /* Logo/date row */
        .header {
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-bottom: 28px;
        }
        .logo { width: 150px; }
        .date { font-size: 13px; }

        /* Title */
        .title {
          text-align:center;
          font-weight:bold;
          font-size: 15px;
          margin: 8px 0 18px 0;
          text-decoration: underline;
        }

        /* Body text */
        p { margin: 8px 0; text-align: justify; }

        /* Watermark (pushed a bit lower than before) */
        .watermark {
          position: fixed;
          top: ${HEADER_H + 170}px;  /* move down by increasing this number */
          left: 50%;
          transform: translateX(-50%);
          opacity: 0.06;
          width: 400px;
          z-index: 0;
        }

        /* Signature row */
        .signature {
          margin-top: 30px;
          margin-bottom: 65px;       /* ensures it sits well above footer */
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .signature-left { text-align: left; }
        .signature-left img { width: 120px; display:block; }
        .signature-left span { display:block; margin-top:6px; }
        .stamp { width: 100px; opacity: 0.9; }
      </style>
    </head>
    <body>
      <!-- Fixed header/footer images from S3 -->
      <img src="${ASSET_BASE}/header.png" class="header-img"/>
      <img src="${ASSET_BASE}/footer.png" class="footer-img"/>

      <!-- Watermark -->
      <img src="${ASSET_BASE}/eduroom-watermark.png" class="watermark"/>

      <div class="content">
        <!-- Logo + Date -->
        <div class="header">
          <img src="${ASSET_BASE}/eduroom-logo.jpg" class="logo"/>
          <div class="date">Date: ${today}</div>
        </div>

        <!-- Title -->
        <div class="title">OFFER LETTER FOR INTERNSHIP</div>

        <!-- Body -->
        <p>Dear ${candidateName},</p>
        <p>
          Congratulations! We are pleased to confirm that you have been selected
          for the role of <b>${position}</b> at Eduroom. We believe that your skills,
          experience, and qualifications make you an excellent fit for this role.
        </p>

        <p><b>Starting Date:</b> ${startDate}</p>
        <p><b>Position:</b> ${position}</p>
        <p><b>Work Location:</b> ${workLocation}</p>

        <p>Benefits for the position include Certification of Internship and LOA (performance-based).</p>

        <p>
          We eagerly anticipate welcoming you to our team and embarking on this journey together.
          Your talents and expertise will enrich our collaborative efforts as we work towards our
          shared goals. We are excited about the opportunity to leverage your skills and contributions
          to drive our company’s success.
        </p>

        <p>Thank you!<br/>Yours sincerely,<br/>Eduroom</p>

        <!-- Signature + Stamp on one line -->
        <div class="signature">
          <div class="signature-left">
            <img src="${ASSET_BASE}/signature.png"/>
            <span>Mrs. Pooja Shedge<br/>Branch Manager</span>
          </div>
          <img src="${ASSET_BASE}/stamp.jpg" class="stamp"/>
        </div>
      </div>
    </body>
  </html>
  `;

  // 3) Generate PDF (A4, single page)
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" }, // content padding already accounts for header/footer
  });

  await browser.close();

  // 4) Upload to S3
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