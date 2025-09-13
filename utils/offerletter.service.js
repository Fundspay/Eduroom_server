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

// helpers for "12th September, 2025"
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function formatDateOrdinal(date) {
  const d = new Date(date);
  const day = ordinal(d.getDate());
  const month = d.toLocaleString("en-GB", { month: "long" });
  const year = d.getFullYear();
  return `${day} ${month}, ${year}`;
}

const generateOfferLetter = async (userId) => {
  if (!userId) throw new Error("Missing userId");

  // 1) Load user
  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false },
  });
  if (!user) throw new Error("User not found");

  const candidateName =
    user.fullName ||
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    "Candidate";

  const position = user.internshipProgram || "Intern";

  const startDateRaw = user.preferredStartDate; // "YYYY-MM-DD" or ISO
  const startDate = startDateRaw ? formatDateOrdinal(startDateRaw) : "To Be Decided";

  const workLocation = user.residentialAddress || "Work from Home";
  const today = formatDateOrdinal(new Date());

  // 2) S3 assets
  const ASSET_BASE = "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets";
  const HEADER_H = 120; // px: visible height of header.png
  const FOOTER_H = 170; // px: visible height of footer.png

  // 3) HTML
  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 0; }
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body {
          margin: 0;
          font-family: "TeXGyreBonum", "Times New Roman", serif; // FONT CHANGE HERE
          font-size: 13px;
          line-height: 1.6;
          color: #111;
          box-sizing: border-box;
        }
        
        @import url('https://fonts.cdnfonts.com/css/tex-gyre-bonum');

        /* Header/Footer images only */
        .header-img {
          position: fixed; top: 0; left: 0; right: 0;
          width: 100%; height: auto; max-height:180px;
          object-fit: cover; object-position: top center;
          display: block; z-index: 1; background: #fff;
        }
        .footer-img {
          position: fixed; left: 0; right: 0; bottom: 0;
          width: 100%; height: ${FOOTER_H}px;
          object-fit: cover; object-position: bottom center;
          display: block; z-index: 1; background: #fff;
        }

        /* Content padded to avoid header/footer overlap */
        .content {
          position: relative; z-index: 2;
          /* more space from header to date by adding +80 instead of +60 */
          padding: ${HEADER_H + 80}px 60px ${FOOTER_H + 34}px 60px;
        }

        /* Date back to top-right, with space above/below */
        .date-line {
          text-align: left;
          margin: 0 0 24px 0;  /* space below date before title */
        }

        /* Title (no underline now) */
        .title {
          text-align: center;
          font-weight: bold;
          font-size: 16px;
          margin: 0 0 18px 0;
          /* no text-decoration */
        }

        p { margin: 8px 0; text-align: justify; }

        /* Watermark lower */
        .watermark {
          position: fixed; left: 50%; transform: translateX(-50%);
          top: ${HEADER_H + 200}px; width: 420px; opacity: 0.06; z-index: 0;
        }

        /* Signature row: left signature + centered stamp */
        .sign-row {
          margin-top: 26px;
          margin-bottom: 100px; /* safe space above footer */
          display: grid;
          grid-template-columns: 1fr 1fr 1fr; /* left / center / spacer */
          align-items: end;
          column-gap: 20px;
        }
        .sig-left { justify-self: start; text-align: left; }
        .sig-left img { width: 120px; display: block; }
        .sig-left span { display: block; margin-top: 6px; }

        .sig-center { justify-self: center; text-align: center; }
        .stamp { width: 110px; opacity: 0.95; display: block; margin: 0 auto; }
      </style>
    </head>
    <body>
      <!-- header/footer images -->
      <img src="${ASSET_BASE}/headernew.png" class="header-img" />
      <img src="${ASSET_BASE}/footer.png" class="footer-img" />

      <!-- watermark -->
      <img src="${ASSET_BASE}/eduroom-watermark.png" class="watermark" />

      <div class="content">
        <!-- DATE at top-right with extra space from header -->
        <div class="date-line">Date: ${today}</div>

        <!-- Title WITHOUT underline -->
        <div class="title">OFFER LETTER FOR INTERNSHIP</div>

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

        <p>Thank you!<br/>Yours Sincerely,<br/>Eduroom</p>

        <!-- Signature + centered stamp -->
        <div class="sign-row">
          <div class="sig-left">
            <img src="${ASSET_BASE}/signature.png" />
            <span>Mrs. Pooja Shedge<br/>Branch Manager</span>
          </div>
          <div class="sig-center">
            <img src="${ASSET_BASE}/stamp.jpg" class="stamp" />
          </div>
          <div></div>
        </div>
      </div>
    </body>
  </html>
  `;

  // 4) Render PDF
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
  });

  await browser.close();

  // 5) Upload to S3
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