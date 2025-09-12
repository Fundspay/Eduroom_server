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

    // Assets
    const logoUrl =
      "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/eduroom-logo.png";
    const stampUrl =
      "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/stamp.png";
    const signatureUrl =
      "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/signature.png";
    const watermarkUrl =
      "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/eduroom-watermark.png";

    let logoBuffer, stampBuffer, signatureBuffer, watermarkBuffer;
    const loadImage = async (url) => {
      try {
        const res = await axios.get(url, { responseType: "arraybuffer" });
        return res.data;
      } catch (err) {
        console.warn("Could not load image:", url, err.message);
        return null;
      }
    };
    [logoBuffer, stampBuffer, signatureBuffer, watermarkBuffer] = await Promise.all([
      loadImage(logoUrl),
      loadImage(stampUrl),
      loadImage(signatureUrl),
      loadImage(watermarkUrl)
    ]);

    // Watermark (center, faded)
    if (watermarkBuffer) {
      doc.save();
      doc.opacity(0.07).image(watermarkBuffer, 150, 250, { width: 300 });
      doc.restore();
    }

    // Header bar + logo
    doc.rect(0, 0, doc.page.width, 70).fill("#009688"); // teal bar
    if (logoBuffer) doc.image(logoBuffer, 40, 15, { width: 120 });
    doc.fillColor("black").moveDown(4);

    // Date
    const today = new Date();
    const formattedDate = today.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    doc.fontSize(11).text(`Date: ${formattedDate}`, { align: "left" });
    doc.moveDown(2);

    // Title
    doc.fontSize(14).font("Helvetica-Bold").text("OFFER LETTER FOR INTERNSHIP", {
      align: "center"
    });
    doc.moveDown(2);

    // Body
    doc.font("Helvetica").fontSize(11).text(`Dear ${candidateName},`);
    doc.moveDown(1);

    doc.text(
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
      "We eagerly anticipate welcoming you to our team and embarking on this journey together. Your talents and expertise will enrich our collaborative efforts as we work towards our shared goals. We are excited about the opportunity to leverage your skills and contributions to drive our company's success.",
      { align: "justify" }
    );
    doc.moveDown(2);

    // Signature + stamp
    doc.text("Thank you!", { align: "left" });
    doc.text("Yours Sincerely,", { align: "left" });
    doc.text("Eduroom", { align: "left" });
    doc.moveDown(2);

    if (signatureBuffer) doc.image(signatureBuffer, 60, doc.y, { width: 100 });
    if (stampBuffer) doc.image(stampBuffer, 300, doc.y - 20, { width: 120 });

    doc.moveDown(5);
    doc.text("Mrs. Pooja Shedge", { align: "left" });
    doc.text("Branch Manager", { align: "left" });

    // Footer bar
    const footerY = doc.page.height - 100;
    doc.rect(0, footerY, doc.page.width, 70).fill("#009688");
    doc.fillColor("white").fontSize(9);
    doc.text("FUNDSROOM", 50, footerY + 10);
    doc.text("Reg: Fundsroom Infotech Pvt Ltd, Pune-411001", 50, footerY + 25);
    doc.text("CIN: U62099PN2025PTC245778", 50, footerY + 40);
    doc.text("Fundsroom HQ, 804 Nucleus Mall, Pune-411001", 300, footerY + 10);
    doc.text("connect@eduroom.in", 300, footerY + 25);
    doc.text("www.eduroom.in", 300, footerY + 40);

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
    console.error("generateOfferLetter error:", err);
    throw err;
  }
};

module.exports = { generateOfferLetter };
