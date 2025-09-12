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

  const html = `
<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; font-size: 12px; line-height: 1.6; }
      .page { padding: 80px 60px 120px 60px; position: relative; }
      
      /* Header strip */
      .header {
        background: #009688;
        color: white;
        padding: 15px 30px;
        display: flex;
        align-items: center;
      }
      .header img {
        height: 40px;
      }
      .date {
        text-align: right;
        margin-top: 20px;
        font-size: 12px;
      }
      
      /* Title */
      .title {
        text-align: center;
        font-weight: bold;
        font-size: 16px;
        margin: 30px 0;
        text-decoration: underline;
      }
      
      /* Watermark */
      .watermark {
        position: absolute;
        top: 40%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 60px;
        font-weight: bold;
        color: rgba(0,150,136,0.1);
        z-index: 0;
        white-space: nowrap;
      }

      /* Main content */
      .content {
        position: relative;
        z-index: 1;
      }

      .signature { margin-top: 50px; }
      .signature img { width: 120px; }

      .stamp {
        position: absolute;
        bottom: 180px;
        right: 120px;
        width: 120px;
        opacity: 0.9;
      }

      /* Footer strip */
      .footer {
        background: #009688;
        color: white;
        padding: 15px 30px;
        font-size: 10px;
        line-height: 1.4;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        display: flex;
        justify-content: space-between;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <img src="https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/eduroom-logo.png"/>
    </div>

    <div class="page">
      <div class="date">Date: ${today}</div>
      <div class="title">OFFER LETTER FOR INTERNSHIP</div>
      
      <div class="watermark">Eduroom</div>

      <div class="content">
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

        <img src="https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/stamp.jpg" class="stamp"/>
      </div>
    </div>

    <div class="footer">
      <div>
        FUNDSROOM · Reg: Fundsroom Infotech Pvt Ltd, Pune-411001 · CIN: U62099PN2025PTC245778
      </div>
      <div>
        Fundsroom HQ, 804 Nucleus Mall, Pune-411001 · connect@eduroom.in · www.eduroom.in
      </div>
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
    margin: { top: "60px", bottom: "120px", left: "50px", right: "50px" }
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
