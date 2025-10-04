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

const ASSET_BASE = "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets";

/**
 * Format date-only fields to DD-MM-YYYY (like your screenshot).
 */
const formatDateDDMMYYYY = (input) => {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB"); // returns DD/MM/YYYY, but screenshot shows dashes — convert:
};

/**
 * Helper to display a value or empty string
 */
const display = (val) => {
  if (val === null || typeof val === "undefined") return "";
  if (typeof val === "string" && val.trim() === "") return "";
  return String(val);
};

/**
 * Generate internship details PDF and upload to S3.
 * Shows most fields from your User model except subscription and courseDates/courseStatuses.
 */
const generateInternshipDetailsReport = async (userId, options = {}) => {
  if (!userId) throw new Error("Missing userId");

  // include associations if exist in models
  const includes = [];
  if (model.Gender) includes.push({ model: model.Gender, attributes: ["id", "name"], required: false });
  if (model.CommunicationMode) includes.push({ model: model.CommunicationMode, attributes: ["id", "name"], required: false });
  if (model.InternshipMode) includes.push({ model: model.InternshipMode, attributes: ["id", "name"], required: false });
  if (model.TeamManager) includes.push({ model: model.TeamManager, as: "teamManager", attributes: ["id", "name"], required: false });

  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false },
    include: includes,
  });

  if (!user) throw new Error("User not found");

  // Build display values
  const firstName = display(user.firstName);
  const lastName = display(user.lastName);
  const fullName = display(user.fullName) || `${firstName} ${lastName}`.trim();
  const dob = user.dateOfBirth ? (new Date(user.dateOfBirth)).toISOString().split("T")[0].replace(/-/g, "-") : "";
  // use en-GB for human readable
  const dobDisplay = user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString("en-GB") : "";

  // Associated names (if present)
  const genderName = user.Gender && user.Gender.name ? user.Gender.name : (user.gender ? String(user.gender) : "");
  const communicationMode = user.CommunicationMode && user.CommunicationMode.name ? user.CommunicationMode.name : "";
  const internshipMode = user.InternshipMode && user.InternshipMode.name ? user.InternshipMode.name : "";
  const teamManagerName = user.teamManager && user.teamManager.name ? user.teamManager.name : "";

  // Build rows in the exact order you want to present them
  const rows = [
    ["Intern Name", fullName],
    ["Date of Birth", dobDisplay],
    ["Gender", genderName],
    ["Email ID", display(user.email)],
    ["Mobile Number", display(user.phoneNumber)],
    ["Alternate Mobile Number", display(user.alternatePhoneNumber)],
    ["Residential Address", display(user.residentialAddress)],
    ["Emergency Contact Name", display(user.emergencyContactName)],
    ["Emergency Contact Number", display(user.emergencyContactNumber)],
    ["State", display(user.state)],
    ["City", display(user.city)],
    ["Pin Code", display(user.pinCode)],
    ["College Name", display(user.collegeName)],
    ["College Roll Number", display(user.collegeRollNumber)],
    ["Course", display(user.course)],
    ["Specialization", display(user.specialization)],
    ["Current Year", display(user.currentYear)],
    ["Current Semester", display(user.currentSemester)],
    ["College Address", display(user.collegeAddress)],
    ["Placement Coordinator Name", display(user.placementCoordinatorName)],
    ["Placement Coordinator Contact", display(user.placementCoordinatorContact)],
    ["Manager Name", display(user.managerName)],
    ["Manager Email", display(user.managerEmail)],
    // Internship related
    ["Internship Program", display(user.internshipProgram)],
    ["Internship Duration", display(user.internshipDuration)],
    ["Internship Mode", internshipMode],
    ["Preferred Start Date", user.preferredStartDate ? new Date(user.preferredStartDate).toLocaleDateString("en-GB") : ""],
    ["Referral Code", display(user.referralCode)],
    ["Referral Source", display(user.referralSource)],
    ["LinkedIn Profile", display(user.linkedInProfile)],
    ["Account Holder Name", display(user.accountHolderName)],
    ["Bank Name", display(user.bankName)],
    ["IFSC Code", display(user.ifscCode)],
    ["Account Number", display(user.accountNumber)],
    ["Assigned Team Manager", teamManagerName],
    ["Preferred Communication", communicationMode],
  ];

  // Remove empty rows if you prefer (keeps consistent layout if you want all rows visible, commented out)
  // const visibleRows = rows.filter(([label, val]) => val && String(val).trim() !== "");
  const visibleRows = rows; // keep all rows (like your screenshot includes empty fields sometimes)

  // background image — default to internships background; allow override through options.bgUrl
  const bgUrl = options.bgUrl || `${ASSET_BASE}/internshipbg.png`;

  // Title date
  const generatedOn = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Build HTML (table designed to paginate across pages)
  const html = `
 <!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>My Internship Details - ${fullName}</title>
  <style>
    @page {
      size: A4;
      margin: 30px 30px 60px 30px;
    }
    html, body {
      height: 100%;
      background: #fff;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: "Times New Roman", serif;
      background-image: url("${bgUrl}");
      background-repeat: no-repeat;
      background-position: center top;
      background-size: cover;
      /* To ensure watermark is behind everything and repeats properly */
      -webkit-print-color-adjust: exact; /* To print background */
    }
    table.details-table {
      width: 100%;
      border-collapse: collapse;
      background: rgba(255,255,255,0.92);
      page-break-after: auto;
    }
    table.details-table th, table.details-table td {
      border: 1px solid #000;
      padding: 6px 8px;
      vertical-align: top;
      word-wrap: break-word;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    .header-row th {
      background: #fff;
      text-align: center;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 12px 0;
    }
    .footer-row td {
      text-align: center;
      font-size: 12px;
      color: #333;
      background: rgba(255,255,255,0.95); /* To ensure watermark is not visible below footer */
      padding: 4px 0;
    }
    .field {
      width: 35%;
      font-weight: 700;
    }
    .value {
      width: 65%;
      color: #b00000;
    }
    /* Avoid breaking inside table rows and cells */
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    td, th {
      page-break-inside: avoid;
    }
    /* For printing */
    @media print {
      body {
        background-image: url("${bgUrl}") !important;
        background-repeat: no-repeat !important;
        background-position: center top !important;
        background-size: cover !important;
        -webkit-print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <table class="details-table">
    <thead>
      <tr class="header-row">
        <th colspan="2">
          <img src="${ASSET_BASE}/fundsweb-logo.png" alt="logo" style="max-width:150px; height:auto; float:left; margin-right:8px; vertical-align:middle;" onerror="this.style.display='none'"/>
          MY INTERNSHIP DETAILS
          <span style="float:right; font-size:12px; font-weight:normal;">${generatedOn}</span>
        </th>
      </tr>
      <tr>
        <th class="field">Field</th>
        <th class="value">Value (Auto-Fetched)</th>
      </tr>
    </thead>
    <tbody>
      ${visibleRows.map(([label, val]) => {
        const safeVal = String(val || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<tr><td class="field">${label}</td><td class="value">${safeVal || "&nbsp;"}</td></tr>`;
      }).join("\n")}
    </tbody>
    <tfoot>
      <tr class="footer-row">
        <td colspan="2">Generated by FundsWeb · ${generatedOn}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>

  `;

  // Render PDF with Puppeteer
  let pdfBuffer;
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    // ensure fonts and images loaded
    await page.evaluateHandle("document.fonts.ready");
    await new Promise((r) => setTimeout(r, 400));

    pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "12mm", right: "12mm" },
    });

    await browser.close();
  } catch (err) {
    throw new Error("PDF generation failed: " + err.message);
  }

 // 5️⃣ Upload to S3
  const timestamp = Date.now();
  const fileName = `internship-report-${timestamp}.pdf`;
  const s3Key = `internshipReports/${userId}/${fileName}`;

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

module.exports = { generateInternshipDetailsReport };
