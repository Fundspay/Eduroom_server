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

    // 🔹 Fetch user with row lock
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

    // 🔹 Check if current date is >= course end date
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const courseEndDate = user.courseDates?.[courseId]?.endDate;

    if (!courseEndDate) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Course end date not found for this user" });
    }

    if (today < courseEndDate) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `You cannot download the certificate before the course end date (${courseEndDate})` 
      });
    }

    const businessTarget = course.businessTarget || 0;

    // 🔹 Calculate remaining balance
    const subscriptionLeft = user.subscriptionWallet - user.subscriptiondeductedWallet;

    if (subscriptionLeft < businessTarget) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "You have not completed the business target assigned to this course. Complete it to get the certificate."
      });
    }

    // ✅ Deduct for this course
    user.subscriptiondeductedWallet += businessTarget;
    user.subscriptionLeft = user.subscriptionWallet - user.subscriptiondeductedWallet;
    await user.save({ transaction });

    // 🔹 Generate certificate PDF + S3 link
    const certificateFile = await generateInternshipCertificate(userId, courseId);

    // 🔹 Create certificate record
    const certificate = await model.InternshipCertificate.create({
      userId,
      courseId,
      certificateUrl: certificateFile.certificateUrl,
      deductedWallet: businessTarget,
      isIssued: true,
      issuedDate: new Date()
    }, { transaction });

    // 🔹 Send email
    const subject = `Your Internship Certificate - ${course.name}`;
    const html = `
      <p>Dear ${user.fullName || user.firstName},</p>
      <p>Congratulations! Please find attached your <b>Internship Certificate</b> for completing the <b>${course.name}</b> course.</p>
      <p>Access it here:</p>
      <p><a href="${certificate.certificateUrl}" target="_blank">${certificate.certificateUrl}</a></p>
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
      message: "Internship Certificate created, wallet deducted, and sent successfully",
      certificateUrl: certificate.certificateUrl,
      deductedWallet: businessTarget,
      subscriptionWallet: user.subscriptionWallet,
      subscriptiondeductedWallet: user.subscriptiondeductedWallet,
      subscriptionLeft: user.subscriptionLeft
    });

  } catch (error) {
    await transaction.rollback();
    console.error("createAndSendInternshipCertificate error:", error);
    return res.status(500).json({ success: false, message: "Server error", error });
  }
};
module.exports.createAndSendInternshipCertificate = createAndSendInternshipCertificate
