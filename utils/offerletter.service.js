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

  // Position/program
  const position = user.internshipProgram || "Intern";

  // Start date
  const startDateRaw = user.preferredStartDate; // "YYYY-MM-DD" or ISO
  const startDate = startDateRaw
    ? formatDateOrdinal(startDateRaw)
    : "To Be Decided";

  const workLocation = user.residentialAddress || "Work from Home";

  // Today with ordinal like sample
  const today = formatDateOrdinal(new Date());

  // 2) Asset base (header/footer/watermark/signature/stamp)
  const ASSET_BASE = "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets";

  // Tune these to your header/footer PNG proportions
  const HEADER_H = 120; // px visible height for header.png
  const FOOTER_H = 130; // px visible height for footer.png

  // 3) HTML
  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { margin: 0; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #111; }

        /* Fixed header/footer images (no extra content inside) */
        .header-img {
          position: fixed; top: 0; left: 0; right: 0;
          width: 100%; height: ${HEADER_H}px; object-fit: cover; display: block; z-index: 1;
        }
        .footer-img {
          position: fixed; bottom: 0; left: 0; right: 0;
          width: 100%; height: ${FOOTER_H}px; object-fit: cover; display: block; z-index: 1;
        }

        /* Content padded so it never overlaps header/footer */
        .content {
          padding: ${HEADER_H + 18}px 60px ${FOOTER_H + 28}px 60px; /* top | right | bottom | left */
          position: relative; z-index: 2;
        }

        /* Date like sample (left under header) */
        .date-line { margin: 6px 0 28px 0; }

        /* Title centered & underlined */
        .title {
          text-align: center; font-weight: bold; font-size: 16px;
          margin: 0 0 18px 0; text-decoration: underline;
        }

        p { margin: 8px 0; text-align: justify; }

        /* Watermark slightly lower than header */
        .watermark {
          position: fixed;
          top: ${HEADER_H + 190}px;  /* move down by increasing this value */
          left: 50%; transform: translateX(-50%);
          opacity: 0.06; width: 420px; z-index: 0;
        }

        /* Signature + Stamp on one line, comfortably above footer */
        .signature {
          margin-top: 26px;
          margin-bottom: 88px;   /* ensures clear gap above footer image */
          display: flex; justify-content: space-between; align-items: center;
        }
        .signature-left { text-align: left; }
        .signature-left img { width: 120px; display: block; }
        .signature-left span { display: block; margin-top: 6px; }
        .stamp { width: 105px; opacity: 0.95; }
      </style>
    </head>
    <body>
      <!-- Only header/footer images -->
      <img src="${ASSET_BASE}/header.png" class="header-img" />
      <img src="${ASSET_BASE}/footer.png" class="footer-img" />

      <!-- Watermark -->
      <img src="${ASSET_BASE}/eduroom-watermark.png" class="watermark" />

      <div class="content">
        <div class="date-line">Date: ${today}</div>

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

        <div class="signature">
          <div class="signature-left">
            <img src="${ASSET_BASE}/signature.png" />
            <span>Mrs. Pooja Shedge<br/>Branch Manager</span>
          </div>
          <img src="${ASSET_BASE}/stamp.jpg" class="stamp" />
        </div>
      </div>
    </body>
  </html>
  `;

  // 4) Generate PDF — margins 0, content padding handles header/footer space
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