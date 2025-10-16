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

const ASSET_BASE =
  "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets";

/**
 * Format date-only fields to DD-MM-YYYY
 */
const formatDateDDMMYYYY = (input) => {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB");
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
 */
const generateInternshipDetailsReport = async (userId, options = {}) => {
  userId = Number(userId);
  if (!userId) throw new Error("Missing userId");

  const includes = [];
  if (model.Gender)
    includes.push({
      model: model.Gender,
      attributes: ["id", "name"],
      required: false,
    });
  if (model.CommunicationMode)
    includes.push({
      model: model.CommunicationMode,
      attributes: ["id", "name"],
      required: false,
    });
  if (model.InternshipMode)
    includes.push({
      model: model.InternshipMode,
      attributes: ["id", "name"],
      required: false,
    });
  if (model.TeamManager)
    includes.push({
      model: model.TeamManager,
      as: "teamManager",
      attributes: ["id", "name"],
      required: false,
    });

  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false },
    include: includes,
  });

  if (!user) throw new Error("User not found");

  // Basic user details
  const firstName = display(user.firstName);
  const lastName = display(user.lastName);
  const fullName = display(user.fullName) || `${firstName} ${lastName}`.trim();
  const dobDisplay = user.dateOfBirth
    ? new Date(user.dateOfBirth).toLocaleDateString("en-GB")
    : "";
  const genderName =
    user.Gender?.name || (user.gender ? String(user.gender) : "");

  // Page 1: Personal Details (up to college address)
  const personalDetailsRows = [
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
    [
      "Placement Coordinator Contact",
      display(user.placementCoordinatorContact),
    ],
  ];

  // Page 2: Commented Section / Extra Details
  const internshipDetailsRows = [
    ["Internship Program", display(user.internshipProgram)],
    ["Internship Duration", display(user.internshipDuration)],
    ["Internship Mode", user.InternshipMode?.name || ""],
    [
      "Preferred Start Date",
      user.preferredStartDate
        ? new Date(user.preferredStartDate).toLocaleDateString("en-GB")
        : "",
    ],
    ["Referral Code", display(user.referralCode)],
    ["Referral Source", display(user.referralSource)],
    ["LinkedIn Profile", display(user.linkedInProfile)],
    ["Account Holder Name", display(user.accountHolderName)],
    ["Bank Name", display(user.bankName)],
    ["IFSC Code", display(user.ifscCode)],
    ["Account Number", display(user.accountNumber)],
    ["Assigned Team Manager", user.teamManager?.name || ""],
    ["Preferred Communication", user.CommunicationMode?.name || ""],
  ];

  const bgUrl = options.bgUrl || `${ASSET_BASE}/internshipbg.png`;
  const generatedOn = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const renderTable = (rows) => `
    <table class="details-table">
      <thead>
        <tr>
          <th class="field">Field</th>
          <th class="value">Value</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(([label, val]) => {
            const safeVal = String(val || "")
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");
            return `<tr><td class="field">${label}</td><td class="value"><span class="red-text">${
              safeVal || "&nbsp;"
            }</span></td></tr>`;
          })
          .join("\n")}
      </tbody>
    </table>
  `;

  // Combine two pages into one HTML
  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>My Internship Details - ${fullName}</title>
    <style>
      body { margin:0; padding:0; font-family:'Times New Roman', serif; }
      .page {
        width:100%;
        min-height:100vh;
        background: url("${bgUrl}") no-repeat center top;
        background-size: cover;
        display:flex;
        flex-direction:column;
        box-sizing:border-box;
        color:#000;
        position:relative;
      }
      .content {
        background: rgba(255,255,255,0.85);
        margin:135px 40px 60px 40px;
        padding:30px 40px;
        border-radius:8px;
        box-sizing:border-box;
      }
      .main-title { font-size:28px; font-weight:bold; text-align:center; margin-bottom:20px; }
      .details-table { width:100%; border-collapse: collapse; margin: 0 auto; }
      .details-table th, .details-table td {
        border:1px solid #000;
        padding:6px 8px;
        font-size:14px;
        vertical-align:middle;
        text-align:center;
      }
      .details-table thead th {
        background-color:#f0f0f0;
        font-weight:bold;
      }
      .red-text {
        color: red;
      }
      .footer {
        position:absolute;
        bottom:10px;
        width:100%;
        text-align:center;
        font-size:14px;
        color:#444;
      }
      .page-break { page-break-after: always; }
    </style>
  </head>
  <body>
    <!-- PAGE 1 -->
    <div class="page">
      <div class="content">
        <div class="main-title">MY INTERNSHIP DETAILS</div>
        ${renderTable(personalDetailsRows)}
      </div>
      <div class="footer">Generated by FundsWeb · ${generatedOn}</div>
    </div>

    <div class="page-break"></div>

    <!-- PAGE 2 -->
    <div class="page">
      <div class="content">
        <div class="main-title">INTERNSHIP & BANK DETAILS</div>
        ${renderTable(internshipDetailsRows)}
      </div>
      <div class="footer">Generated by FundsWeb · ${generatedOn}</div>
    </div>
  </body>
  </html>
  `;

  // Generate PDF
  let pdfBuffer;
  try {
    const browser = await puppeteer.launch({
      headless: true,
       args: ["--no-sandbox", "--disable-setuid-sandbox" , "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluateHandle("document.fonts.ready");
    await new Promise((r) => setTimeout(r, 400));

    pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" },
    });

    await browser.close();
  } catch (err) {
    throw new Error("PDF generation failed: " + err.message);
  }

  return pdfBuffer;
};

module.exports = { generateInternshipDetailsReport };
