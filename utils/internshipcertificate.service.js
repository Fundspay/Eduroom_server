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

const generateInternshipCertificate = async (userId, courseId) => {
  try {
    if (!userId) throw new Error("Missing userId");
    if (!courseId) throw new Error("Missing courseId");

    // Load user
    const user = await model.User.findOne({
      where: { id: userId, isDeleted: false }
    });
    if (!user) throw new Error("User not found");

    // Load course
    const course = await model.Course.findOne({
      where: { id: courseId, isDeleted: false }
    });
    if (!course) throw new Error("Course not found");

    // Candidate & Course details
    const candidateName = user.fullName || `${user.firstName} ${user.lastName}`;
    const courseName = course.name;
    const completionDate = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    // Metadata
    const timestamp = Date.now();
    const fileName = `internship-certificate-${timestamp}.pdf`;
    const s3Key = `internshipcertificates/${userId}/${fileName}`;

    // PDF → S3 stream
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const passStream = new PassThrough();
    const s3Upload = s3
      .upload({
        Bucket: CONFIG.awsBucketName || "fundsweb",
        Key: s3Key,
        Body: passStream,
        ContentType: "application/pdf"
      })
      .promise();
    doc.pipe(passStream);

    // Load watermark/logo
    const watermarkUrl = CONFIG.watermarkUrl || "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/fundsroom-logo.png";
    const logoUrl = CONFIG.logoUrl || "https://fundsweb.s3.ap-south-1.amazonaws.com/fundsroom/assets/fundsweb-logo.png";

    let watermarkBuffer, logoBuffer;
    try {
      const wmResponse = await axios.get(watermarkUrl, { responseType: "arraybuffer" });
      watermarkBuffer = wmResponse.data;
    } catch (err) {
      console.warn("Could not load watermark:", err.message);
    }
    try {
      const logoResponse = await axios.get(logoUrl, { responseType: "arraybuffer" });
      logoBuffer = logoResponse.data;
    } catch (err) {
      console.warn("Could not load logo:", err.message);
    }

    // Watermark
    if (watermarkBuffer) {
      doc.save();
      doc.opacity(0.05).image(watermarkBuffer, 170, 250, { width: 250 }).opacity(1);
      doc.restore();
    }

    // Logo & header
    if (logoBuffer) doc.image(logoBuffer, 50, 30, { width: 80 });
    doc.fontSize(14).text("Fundsroom Investment Services", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).text("Registered at Pune, India", { align: "center" });
    doc.moveDown(1);

    // Title
    doc.fontSize(16).text("INTERNSHIP CERTIFICATE", { align: "center", underline: true });
    doc.moveDown(2);

    // Body content
    doc.fontSize(12).text(`This is to certify that`, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(14).text(candidateName, { align: "center", underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`has successfully completed the internship for the course:`, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(14).text(courseName, { align: "center", underline: true });
    doc.moveDown(1);

    doc.fontSize(12).text(
      `This certificate is awarded in recognition of the dedication, hard work, and successful completion of the internship program. The internship included practical and theoretical training as per the curriculum of Fundsroom Investment Services.`,
      { align: "justify" }
    );
    doc.moveDown(2);

    doc.fontSize(12).text(`Date of Completion: ${completionDate}`, { align: "left" });
    doc.moveDown(2);

    // Footer
    doc.fontSize(12).text("Best Regards,", { align: "left" });
    doc.moveDown(1);
    doc.text("Fundsroom Investment Services", { align: "left" });
    doc.moveDown(1);
    doc.text("HR & Internship Team", { align: "left" });

    // Finish PDF
    doc.end();
    const s3Result = await s3Upload;

    // Store in DB
    const created = await model.InternshipCertificate.create({
      userId,
      courseId,
      certificateUrl: s3Result.Location,
      deductedWallet: 0, // initially zero
      isIssued: false
    });

    return created;
  } catch (err) {
    console.error("generateInternshipCertificate error:", err);
    throw err;
  }
};

module.exports = { generateInternshipCertificate };
