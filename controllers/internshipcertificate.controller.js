"use strict";
const { generateInternshipCertificate } = require("../utils/internshipcertificate.service");
const { sendMail } = require("../middleware/mailer.middleware");
const model = require("../models");
const sequelize = model.sequelize;

const createAndSendInternshipCertificate = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { userId, courseId } = req.body;

    if (!userId || !courseId) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "userId and courseId are required" });
    }

    // 🔹 Fetch user
    const user = await model.User.findOne({
      where: { id: userId, isDeleted: false },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 🔹 Fetch course
    const course = await model.Course.findOne({
      where: { id: courseId, isDeleted: false },
      transaction
    });
    if (!course) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    // 🔹 Generate certificate PDF + S3 link
    const certificateFile = await generateInternshipCertificate(userId, courseId);

    if (!certificateFile?.fileUrl) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: "Certificate generation failed: fileUrl is missing"
      });
    }

    // 🔹 Create certificate record
    const certificate = await model.InternshipCertificate.create({
      userId,
      courseId,
      certificateUrl: certificateFile.fileUrl,
      isIssued: true,
      issuedDate: new Date()
    }, { transaction });

    // 🔹 Send email
    const subject = `Your Internship Certificate - ${course.name}`;
    const html = `
  <p>Dear ${user.fullName || user.firstName},</p>
  <p>Congratulations! Please find attached your <b>Internship Certificate</b> for completing the <b>${course.name}</b> course.</p>
  <p>Access it here:</p>
  <p><a href="${certificateFile.fileUrl}" target="_blank">${certificateFile.fileUrl}</a></p>
  <br/>
  <p>Best Regards,<br/>${course.name} Team</p>
`;

    const mailResult = await sendMail(user.email, subject, html);
    if (!mailResult.success) {
      await transaction.rollback();
      return res.status(500).json({ success: false, message: "Failed to send email", error: mailResult.error });
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Internship Certificate created and sent successfully",
      certificateUrl: certificate.certificateUrl
    });

  } catch (error) {
    await transaction.rollback();
    console.error("createAndSendInternshipCertificate error:", error);
    return res.status(500).json({ success: false, message: "Server error", error });
  }
};

module.exports.createAndSendInternshipCertificate = createAndSendInternshipCertificate;
