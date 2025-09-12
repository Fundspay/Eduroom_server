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

    // --- Load User ---
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

    // --- Metadata ---
    const timestamp = Date.now();
    const fileName = `offerletter-${timestamp}.pdf`;
    const s3Key = `offerletters/${userId}/${fileName}`;

    // --- PDF Stream ---
    const doc = new PDFDocument({ margin: 50, size: "A4" });
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

    // --- Assets ---
    const logoUrl =
      "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/eduroom-logo.png";
    const stampUrl =
      "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/stamp.png";
    const signatureUrl =
      "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/signature.png";
    const watermarkUrl =
      "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/eduroom-watermark.png";

    const loadImage = async (url) => {
      try {
        const res = await axios.get(url, { responseType: "arraybuffer" });
        return res.data;
      } catch (err) {
        console.warn("Could not load image:", url, err.message);
        return null;
      }
    };

    const [logoBuffer, stampBuffer, signatureBuffer, watermarkBuffer] =
      await Promise.all([
        loadImage(logoUrl),
        loadImage(stampUrl),
        loadImage(signatureUrl),
        loadImage(watermarkUrl)
      ]);

    // --- Watermark ---
    if (watermarkBuffer) {
      doc.save();
      doc.opacity(0.05).image(watermarkBuffer, 150, 220, { width: 300 }).opacity(1);
      doc.restore();
    }

    // --- Logo ---
    if (logoBuffer) {
      doc.image(logoBuffer, 40, 30, { width: 120 });
    }

    // --- Date (top-right) ---
    const today = new Date();
    const formattedDate = today.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    doc.fontSize(11).text(`Date: ${formattedDate}`, 400, 60);

    doc.moveDown(4);

    // --- Title ---
    doc.fontSize(16).text("OFFER LETTER FOR INTERNSHIP", {
      align: "center",
      underline: true
    });
    doc.moveDown(3);

    // --- Greeting ---
    doc.fontSize(12).text(`Dear ${candidateName},`, { align: "left" });
    doc.moveDown(1);

    // --- Body Content ---
    doc.fontSize(11).text(
      `Congratulations! We are pleased to confirm that you have been selected for the role of ${position} at Eduroom. We believe that your skills, experience, and qualifications make you an excellent fit for this role.`,
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

    // --- Closing ---
    doc.text("Thank you!", { align: "left" });
    doc.moveDown(1);
    doc.text("Yours Sincerely,", { align: "left" });
    doc.moveDown(1);
    doc.text("Eduroom");

    // --- Signature ---
    if (signatureBuffer) {
      doc.image(signatureBuffer, 40, doc.y + 10, { width: 100 });
    }

    doc.moveDown(4);
    doc.text("Mrs. Pooja Shedge", { align: "left" });
    doc.text("Branch Manager");
    doc.moveDown(1);

    // --- Stamp ---
    if (stampBuffer) {
      doc.image(stampBuffer, 350, doc.y - 80, { width: 120 });
    }

    // --- Footer Strip ---
    const footerHeight = 60;
    doc.rect(0, doc.page.height - footerHeight, doc.page.width, footerHeight)
      .fill("#009688");
    doc.fillColor("white").fontSize(9);

    doc.text(
      "FUNDSROOM\nReg: Fundsroom Infotech Pvt Ltd, Pune-411001\nCIN: U62099PN2025PTC245778",
      40,
      doc.page.height - footerHeight + 10,
      { align: "left" }
    );

    doc.text(
      "Fundsroom HQ, 804 Nucleus Mall, Pune-411001\nconnect@eduroom.in\nwww.eduroom.in",
      -40,
      doc.page.height - footerHeight + 10,
      { align: "right" }
    );

    // --- Finalize PDF ---
    doc.end();
    await s3Upload;

    // --- Save Record ---
    const offerLetter = await model.OfferLetter.create({
      userId,
      position,
      startDate,
      location: workLocation,
      fileUrl: `https://fundsweb.s3.ap-south-1.amazonaws.com/${s3Key}`
    });

    return offerLetter;
  } catch (err) {
    console.error("Error generating offer letter:", err);
    throw err;
  }
};

module.exports = { generateOfferLetter };
