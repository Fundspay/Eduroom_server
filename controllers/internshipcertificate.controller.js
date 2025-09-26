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

    // 🔹 Check FundsAudit: all registered users must have hasPaid === true
    const fundsRecords = await model.FundsAudit.findAll({
      where: { userId }
    });

    if (fundsRecords.length > 0) {
      const allPaid = fundsRecords.every(record => record.hasPaid === true);
      if (!allPaid) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Certificate cannot be issued: not all referred users have paid."
        });
      }
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

    // 🔹 Get business target
    const userTarget = user.businessTargets?.[courseId];
    const rawTarget = parseInt(userTarget !== undefined ? userTarget : course?.businessTarget || 0, 10);
    const businessTarget = rawTarget < 0 ? 0 : rawTarget;

    // 🔹 Deduct subscription
    const subscriptionWallet = parseInt(user.subscriptionWallet || 0, 10);
    const subscriptiondeductedWallet = parseInt(user.subscriptiondeductedWallet || 0, 10);
    const newDeductedWallet = subscriptiondeductedWallet + businessTarget;
    const newSubscriptionLeft = Math.max(0, subscriptionWallet - newDeductedWallet);

    user.subscriptiondeductedWallet = newDeductedWallet;
    user.subscriptionLeft = newSubscriptionLeft;

    await user.save({
      fields: ["subscriptiondeductedWallet", "subscriptionLeft"],
      transaction
    });

    // 🔹 Generate certificate PDF + S3 link
    const certificateFile = await generateInternshipCertificate(userId, courseId);
    if (!certificateFile?.fileUrl) {
      await transaction.rollback();
      return res.status(500).json({ success: false, message: "Certificate generation failed: fileUrl is missing" });
    }

    // 🔹 Create certificate record
    const certificate = await model.InternshipCertificate.create({
      userId,
      courseId,
      certificateUrl: certificateFile.fileUrl,
      isIssued: true,
      issuedDate: new Date(),
      deductedWallet: businessTarget
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
      message: "Internship Certificate created, wallet updated, and email sent successfully",
      certificateUrl: certificate.certificateUrl,
      wallet: {
        businessTarget,
        subscriptionWallet,
        subscriptiondeductedWallet: newDeductedWallet,
        subscriptionLeft: newSubscriptionLeft
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error("createAndSendInternshipCertificate error:", error);
    return res.status(500).json({ success: false, message: "Server error", error });
  }
};

module.exports.createAndSendInternshipCertificate = createAndSendInternshipCertificate;
