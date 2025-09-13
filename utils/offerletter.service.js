// "use strict";
// const AWS = require("aws-sdk");
// const puppeteer = require("puppeteer");
// const CONFIG = require("../config/config");
// const model = require("../models");

// const s3 = new AWS.S3({
//   accessKeyId: CONFIG.awsAccessKeyId,
//   secretAccessKey: CONFIG.awsSecretAccessKey,
//   region: CONFIG.awsRegion,
// });

// // helpers for "12th September, 2025"
// function ordinal(n) {
//   const s = ["th", "st", "nd", "rd"];
//   const v = n % 100;
//   return n + (s[(v - 20) % 10] || s[v] || s[0]);
// }
// function formatDateOrdinal(date) {
//   const d = new Date(date);
//   const day = ordinal(d.getDate());
//   const month = d.toLocaleString("en-GB", { month: "long" });
//   const year = d.getFullYear();
//   return `${day} ${month}, ${year}`;
// }

// const generateOfferLetter = async (userId) => {
//   if (!userId) throw new Error("Missing userId");

//   // 1) Load user
//   const user = await model.User.findOne({
//     where: { id: userId, isDeleted: false },
//   });
//   if (!user) throw new Error("User not found");

//   const candidateName =
//     user.fullName ||
//     `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
//     "Candidate";

//   const position = user.internshipProgram || "Intern";

//   const startDateRaw = user.preferredStartDate; // "YYYY-MM-DD" or ISO
//   const startDate = startDateRaw ? formatDateOrdinal(startDateRaw) : "To Be Decided";

//   const workLocation = user.residentialAddress || "Work from Home";
//   const today = formatDateOrdinal(new Date());

//   // 2) S3 assets
//   const ASSET_BASE = "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets";
//   const HEADER_H = 120; // px: visible height of header.png
//   const FOOTER_H = 170; // px: visible height of footer.png

//   // 3) HTML
//   const html = `
//   <html>
//     <head>
//       <meta charset="utf-8" />
//       <style>
//         @page { size: A4; margin: 0; }
//         html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
//         @import url('https://fonts.googleapis.com/css2?family=EB+Garamond&display=swap');
//         body {
//           margin: 0;
//           font-family: "EB Garamond", "Times New Roman", serif;
//           font-size: 13px;
//           line-height: 1.6;
//           color: #111;
//           box-sizing: border-box;
//         }
        
//         @import url('https://fonts.cdnfonts.com/css/tex-gyre-bonum');

//         /* Header/Footer images only */
//         .header-img {
//           position: fixed; top: 0; left: 0; right: 0;
//           width: 100%; height: auto; max-height:180px;
//           object-fit: cover; object-position: top center;
//           display: block; z-index: 1; background: #fff;
//         }
//         .footer-img {
//           position: fixed; left: 0; right: 0; bottom: 0;
//           width: 100%; height: ${FOOTER_H}px;
//           object-fit: cover; object-position: bottom center;
//           display: block; z-index: 1; background: #fff;
//         }

//         /* Content padded to avoid header/footer overlap */
//         .content {
//           position: relative; z-index: 2;
//           /* more space from header to date by adding +80 instead of +60 */
//           padding: ${HEADER_H + 80}px 60px ${FOOTER_H + 34}px 60px;
//         }

//         /* Date back to top-right, with space above/below */
//         .date-line {
//           text-align: left;
//           margin: 0 0 24px 0;  /* space below date before title */
//         }

//         /* Title (no underline now) */
//         .title {
//           text-align: center;
//           font-weight: bold;
//           font-size: 16px;
//           margin: 0 0 18px 0;
//           /* no text-decoration */
//         }

//         p { margin: 8px 0; text-align: justify; }

//         /* Watermark lower */
//         .watermark {
//           position: fixed; left: 50%; transform: translateX(-50%);
//           top: ${HEADER_H + 200}px; width: 420px; opacity: 0.06; z-index: 0;
//         }

//         /* Signature row: left signature + centered stamp */
//         .sign-row {
//           margin-top: 26px;
//           margin-bottom: 100px; /* safe space above footer */
//           display: grid;
//           grid-template-columns: 1fr 1fr 1fr; /* left / center / spacer */
//           align-items: end;
//           column-gap: 20px;
//         }
//         .sig-left { justify-self: start; text-align: left; }
//         .sig-left img { width: 120px; display: block; }
//         .sig-left span { display: block; margin-top: 6px; }

//         .sig-center { justify-self: center; text-align: center; }
//         .stamp { width: 110px; opacity: 0.95; display: block; margin: 0 auto; }
//       </style>
//     </head>
//     <body>
//       <!-- header/footer images -->
//       <img src="${ASSET_BASE}/headernew.png" class="header-img" />
//       <img src="${ASSET_BASE}/footer.png" class="footer-img" />

//       <!-- watermark -->
//       <img src="${ASSET_BASE}/eduroom-watermark.png" class="watermark" />

//       <div class="content">
//         <!-- DATE at top-right with extra space from header -->
//         <div class="date-line">Date: ${today}</div>

//         <!-- Title WITHOUT underline -->
//         <div class="title">OFFER LETTER FOR INTERNSHIP</div>

//         <p>Dear ${candidateName},</p>

//         <p>
//           Congratulations! We are pleased to confirm that you have been selected
//           for the role of <b>${position}</b> at Eduroom. We believe that your skills,
//           experience, and qualifications make you an excellent fit for this role.
//         </p>

//         <p><b>Starting Date:</b> ${startDate}</p>
//         <p><b>Position:</b> ${position}</p>
//         <p><b>Work Location:</b> ${workLocation}</p>

//         <p>Benefits for the position include Certification of Internship and LOA (performance-based).</p>

//         <p>
//           We eagerly anticipate welcoming you to our team and embarking on this journey together.
//           Your talents and expertise will enrich our collaborative efforts as we work towards our
//           shared goals. We are excited about the opportunity to leverage your skills and contributions
//           to drive our company’s success.
//         </p>

//         <p>Thank you!<br/>Yours Sincerely,<br/>Eduroom</p>

//         <!-- Signature + centered stamp -->
//         <div class="sign-row">
//           <div class="sig-left">
//             <img src="${ASSET_BASE}/signature.png" />
//             <span>Mrs. Pooja Shedge<br/>Branch Manager</span>
//           </div>
//           <div class="sig-center">
//             <img src="${ASSET_BASE}/stamp.jpg" class="stamp" />
//           </div>
//           <div></div>
//         </div>
//       </div>
//     </body>
//   </html>
//   `;

//   // 4) Render PDF
//   const browser = await puppeteer.launch({
//     headless: true,
//     args: ["--no-sandbox", "--disable-setuid-sandbox"],
//   });
//   const page = await browser.newPage();
//   await page.setContent(html, { waitUntil: "networkidle0" });

//   const pdfBuffer = await page.pdf({
//     format: "A4",
//     printBackground: true,
//     margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
//   });

//   await browser.close();

//   // 5) Upload to S3
//   const timestamp = Date.now();
//   const fileName = `offerletter-${timestamp}.pdf`;
//   const s3Key = `offerletters/${userId}/${fileName}`;

//   await s3
//     .putObject({
//       Bucket: "fundsweb",
//       Key: s3Key,
//       Body: pdfBuffer,
//       ContentType: "application/pdf",
//     })
//     .promise();

//   return {
//     fileName,
//     fileUrl: `https://fundsweb.s3.ap-south-1.amazonaws.com/${s3Key}`,
//   };
// };

// module.exports = { generateOfferLetter };


"use strict";

const AWS = require("aws-sdk");
const puppeteer = require("puppeteer");
const CONFIG = require("../config/config");
const model = require("../models");

// Configure AWS S3 client
const s3 = new AWS.S3({
  accessKeyId: CONFIG.awsAccessKeyId,
  secretAccessKey: CONFIG.awsSecretAccessKey,
  region: CONFIG.awsRegion,
});

/**
 * Normalize input date string to ISO YYYY-MM-DD format.
 */
const normalizeDateToISO = (input) => {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d)) return null;
  return d.toISOString().split("T")[0];
};

/**
 * Format date with ordinal suffix (e.g., "13th September 2025").
 */
const formatDateOrdinal = (date) => {
  if (!(date instanceof Date) || isNaN(date)) return "Invalid Date";
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

/**
 * Generate an offer letter PDF for a given user and upload it to S3.
 */
const generateOfferLetter = async (userId) => {
  if (!userId) throw new Error("Missing userId");

  // 1) Load user
  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false },
  });
  if (!user) throw new Error("User not found");

  const candidateName = user.fullName || `${user.firstName} ${user.lastName}`;

  // 2) Resolve course from courseDates
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

  // 3) Fallback position
  const position = courseName || user.course || user.internshipProgram || "Intern";

  // 4) Format start date + today
  const startDate = user.preferredStartDate
    ? new Date(user.preferredStartDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "To Be Decided";

  const workLocation = user.residentialAddress || "Work from Home";
  const today = formatDateOrdinal(new Date());

  // 5) HTML content
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Offer Letter</title>
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
      background: url("https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/background.png") no-repeat center;
      background-size: cover;
      margin: 20px auto;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }
    .certificate .name {
      position: absolute;
      top: 290px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 98px;
      font-family: "Brush Script MT", cursive;
      color: #b08d2e;
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
    }
    .certificate .date {
      position: absolute;
      bottom: 190px;
      left: 630px;
      font-size: 18px;
      font-weight: bold;
      color: #004225;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="name">${candidateName}</div>
    <div class="description">
      In appreciation of his/her exceptional achievements and<br/>
      contributions in ${position}, which have greatly enhanced the<br/>
      values of Eduroom.
    </div>
    <div class="date">${today}</div>
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

    pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
    });

    await browser.close();
  } catch (err) {
    throw new Error("PDF generation failed: " + err.message);
  }

  // 7) Upload PDF to S3
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
