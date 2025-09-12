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

const generateOfferLetter = async (userId) => {
  if (!userId) throw new Error("Missing userId");

  // 1. Load user
  const user = await model.User.findOne({
    where: { id: userId, isDeleted: false }
  });
  if (!user) throw new Error("User not found");

  const candidateName = user.fullName || `${user.firstName} ${user.lastName}`;
  const position = user.internshipProgram || "Intern";
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

  // 2. Build HTML template
  const html = `
  <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 50px; font-size: 12px; line-height: 1.6; position: relative; }
        .header { display:flex; justify-content:space-between; align-items:center; }
        .logo { width:150px; }
        .title { text-align:center; font-weight:bold; font-size:18px; margin:30px 0; text-decoration: underline; }
        .footer {
          background:#009688; color:white; padding:10px 30px;
          position:fixed; bottom:0; left:0; right:0;
          font-size:10px; line-height:1.4;
        }
        .stamp { position:absolute; bottom:150px; right:100px; opacity:0.85; width:120px; }
        .signature { margin-top:50px; }
        .signature img { width:120px; }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/eduroom-logo.png" class="logo"/>
        <div>Date: ${today}</div>
      </div>

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

      <p>
        Benefits for the position include Certification of Internship and LOA
        (performance-based).
      </p>

      <p>
        We eagerly anticipate welcoming you to our team and embarking on this journey together.
        Your talents and expertise will enrich our collaborative efforts as we work towards our
        shared goals. We are excited about the opportunity to leverage your skills and contributions
        to drive our company’s success.
      </p>

      <p>Thank you!<br/>Yours sincerely,<br/>Eduroom</p>

      <div class="signature">
        <img src="https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/signature.png"/><br/>
        Mrs. Pooja Shedge<br/>Branch Manager
      </div>

      <img src="https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/stamp.png" class="stamp"/>

      <div class="footer">
        FUNDSROOM · Reg: Fundsroom Infotech Pvt Ltd, Pune-411001 · CIN: U62099PN2025PTC245778<br/>
        Fundsroom HQ, 804 Nucleus Mall, Pune-411001 · connect@eduroom.in · www.eduroom.in
      </div>
    </body>
  </html>
  `;

  // 3. Generate PDF from HTML
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "40px", bottom: "100px", left: "40px", right: "40px" }
  });

  await browser.close();

  // 4. Upload to S3
  const timestamp = Date.now();
  const fileName = `offerletter-${timestamp}.pdf`;
  const s3Key = `offerletters/${userId}/${fileName}`;

  await s3
    .putObject({
      Bucket: "fundsweb",
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: "application/pdf"
    })
    .promise();

  return {
    fileName,
    fileUrl: `https://fundsweb.s3.ap-south-1.amazonaws.com/${s3Key}`
  };
};

module.exports = { generateOfferLetter };
