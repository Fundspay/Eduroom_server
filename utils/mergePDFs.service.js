"use strict";
const { PDFDocument } = require("pdf-lib");
const AWS = require("aws-sdk");
const CONFIG = require("../config/config");

const s3 = new AWS.S3({
  accessKeyId: CONFIG.awsAccessKeyId,
  secretAccessKey: CONFIG.awsSecretAccessKey,
  region: CONFIG.awsRegion,
});

/**
 * Merge multiple PDF buffers and upload to S3
 */
const mergePDFsAndUpload = async (userId, pdfBuffers) => {
  if (!pdfBuffers || pdfBuffers.length === 0) {
    throw new Error("No PDF buffers provided to merge");
  }

  // 1️⃣ Create a new merged PDF
  const mergedPdf = await PDFDocument.create();

  for (const buffer of pdfBuffers) {
    const pdf = await PDFDocument.load(buffer);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((p) => mergedPdf.addPage(p));
  }

  const mergedBuffer = await mergedPdf.save();

  // 2️⃣ Upload merged file to S3
  const timestamp = Date.now();
  const fileName = `merged-report-${timestamp}.pdf`;
  const s3Key = `internshipReports/${userId}/${fileName}`;

  await s3
    .putObject({
      Bucket: "fundsweb",
      Key: s3Key,
      Body: mergedBuffer,
      ContentType: "application/pdf",
    })
    .promise();

  return {
    fileName,
    fileUrl: `https://fundsweb.s3.ap-south-1.amazonaws.com/${s3Key}`,
  };
};

module.exports = { mergePDFsAndUpload };
