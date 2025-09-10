"use strict";
const PDFDocument = require("pdfkit");
const axios = require("axios");
const AWS = require("aws-sdk");
const { PassThrough } = require("stream");
const CONFIG = require("../config/config");
const model = require("../models");

const s3 = new AWS.S3({
  accessKeyId: CONFIG.awsAccessKeyId,
  secretAccessKey: CONFIG.awsSecretAccessKey,
  region: CONFIG.awsRegion
});

const generateOfferLetter = async (userId) => {
  try {
    if (!userId) throw new Error("Missing userId");

    // Load user
    const user = await model.User.findOne({
      where: { id: userId, isDeleted: false }
    });
    if (!user) throw new Error("User not found");

    // Example: fetch details from User table
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

    // Metadata
    const timestamp = Date.now();
    const fileName = `offerletter-${timestamp}.pdf`;
    const s3Key = `offerletters/${userId}/${fileName}`;

    // PDF → S3 stream
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const passStream = new PassThrough();
    const s3Upload = s3
      .upload({
        Bucket: "fundsweb",
        Key: s3Key,
        Body: passStream,
        ContentType: "application/pdf"
      })
      .promise();
    doc.pipe(passStream);

    // Assets
    const watermarkUrl =
      "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/fundsroom-logo.png";
    const logoUrl =
      "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/fundsweb-logo.png";

    let watermarkBuffer, logoBuffer;
    try {
      const wmResponse = await axios.get(watermarkUrl, { responseType: "arraybuffer" });
      watermarkBuffer = wmResponse.data;
    } catch (err) {
      console.warn(" Could not load watermark:", err.message);
    }
    try {
      const logoResponse = await axios.get(logoUrl, { responseType: "arraybuffer" });
      logoBuffer = logoResponse.data;
    } catch (err) {
      console.warn(" Could not load logo:", err.message);
    }

    // Add watermark
    if (watermarkBuffer) {
      doc.save();
      doc.opacity(0.05).image(watermarkBuffer, 170, 250, { width: 250 }).opacity(1);
      doc.restore();
    }

    // Add logo + header
    if (logoBuffer) {
      doc.image(logoBuffer, 50, 30, { width: 80 });
    }
    doc.fontSize(14).text("Fundsroom Investment Services", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).text("Registered at Pune, India", { align: "center" });
    doc.text("Reg no: PU000119357", { align: "center" });
    doc.text("GSTIN: 27AAHFF5448A1ZM", { align: "center" });
    doc.moveDown(1);

    // Contact
    doc.fontSize(10).text(": www.fundsaudit.in", { align: "left" });
    doc.text(": support@fundsaudit.co.in", { align: "left" });
    doc.moveDown(1);

    // Date
    const today = new Date();
    const formattedDate = today.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    doc.fontSize(11).text(`Date: ${formattedDate}`, { align: "left" });
    doc.moveDown(1);

    // Title
    doc.fontSize(13).text("OFFER LETTER FOR INTERNSHIP", {
      align: "center",
      underline: true
    });
    doc.moveDown(2);

    // Body
    doc.fontSize(11).text(`Dear ${candidateName},`);
    doc.moveDown(1);

    doc.text(
      `Congratulations! We are pleased to confirm that you have been selected for the role of ${position} at Fundsaudit (Fundsroom Investment Services). We believe that your skills, experience, and qualifications make you an excellent fit for this role.`,
      { align: "justify" }
    );
    doc.moveDown(1);

    doc.text(`Starting Date: ${startDate}`);
    doc.text(`Position: ${position}`);
    doc.text(`Work Location: ${workLocation}`);
    doc.moveDown(1);

    doc.text(
      "Benefits for the position include Certification of Internship and LOA (performance-based).",
      { align: "justify" }
    );
    doc.moveDown(1);

    doc.text(
      "We eagerly anticipate welcoming you to our team and embarking on this journey together. Your talents and expertise will enrich our collaborative efforts as we work towards our shared goals. We are excited about the opportunity to leverage your skills and contributions to drive our company’s success.",
      { align: "justify" }
    );
    doc.moveDown(2);

    // Footer
    doc.text("Thank you!", { align: "left" });
    doc.moveDown(1);
    doc.text("Yours Sincerely", { align: "left" });
    doc.moveDown(1);
    doc.text("Fundsroom Investment Services");
    doc.moveDown(1);
    doc.text("Mrs. Pooja Shedge", { align: "left" });
    doc.text("Branch Manager");
    doc.text("http://www.fundsroom.com/");
    doc.text("connect@fundroom.com");

    // Finish PDF
    doc.end();
    const s3Result = await s3Upload;

    // Store in DB
    const created = await model.OfferLetter.create({
      userId,
      position,
      startDate,
      location: workLocation,
      fileUrl: s3Result.Location
    });

    return created;
  } catch (err) {
    console.error(" generateOfferLetter error:", err);
    throw err;
  }
};

module.exports = { generateOfferLetter };