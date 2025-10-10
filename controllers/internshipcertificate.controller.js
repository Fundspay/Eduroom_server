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

    // 🔹 (FundsAudit check removed)

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

    // 🔹 Wallet info
    const subscriptionWallet = parseInt(user.subscriptionWallet || 0, 10); // total earned
    let newDeductedWallet = parseInt(user.subscriptiondeductedWallet || 0, 10);
    let newSubscriptionLeft = Math.max(0, subscriptionWallet - newDeductedWallet);

    // 🔹 Check if certificate already exists
    let certificate = await model.InternshipCertificate.findOne({ where: { userId, courseId } });

    // 🔹 Deduct wallet and create certificate only first-time
    if (!certificate) {
      const currentLeft = newSubscriptionLeft;

      if (currentLeft < businessTarget) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Insufficient subscription wallet, business target not met",
          wallet: {
            totalSubscribed: subscriptionWallet,
            businessTarget,
            totalDeducted: newDeductedWallet,
            subscriptionLeft: currentLeft
          }
        });
      }

      newDeductedWallet += businessTarget;
      newSubscriptionLeft = subscriptionWallet - newDeductedWallet;

      user.subscriptiondeductedWallet = newDeductedWallet;
      user.subscriptionLeft = newSubscriptionLeft;

      await user.save({
        fields: ["subscriptiondeductedWallet", "subscriptionLeft"],
        transaction
      });

      // 🔹 Create certificate record
      const certificateFile = await generateInternshipCertificate(userId, courseId);
      if (!certificateFile?.fileUrl) {
        await transaction.rollback();
        return res.status(500).json({ success: false, message: "Certificate generation failed: fileUrl is missing" });
      }

      certificate = await model.InternshipCertificate.create({
        userId,
        courseId,
        certificateUrl: certificateFile.fileUrl,
        isIssued: true,
        issuedDate: new Date(),
        deductedWallet: businessTarget
      }, { transaction });
    }

    // 🔹 Generate certificate PDF link for download (always)
    const certificateFile = await generateInternshipCertificate(userId, courseId);
    if (!certificateFile?.fileUrl) {
      await transaction.rollback();
      return res.status(500).json({ success: false, message: "Certificate generation failed: fileUrl is missing" });
    }

    // 🔹 Send email every time user clicks download
    const subject = `Your Internship Certificate - ${course.name}`;
    const html = `
      <p>Dear ${user.fullName || user.firstName},</p>
      <p>Here is your <b>Internship Certificate</b> for completing the <b>${course.name}</b> course.</p>
      <p>Access it here:</p>
      <p><a href="${certificateFile.fileUrl}" target="_blank">${certificateFile.fileUrl}</a></p>
      <br/>
      <p>Best Regards,<br/>${course.name} Team</p>
    `;
    await sendMail(user.email, subject, html);

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Internship Certificate available",
      certificateUrl: certificateFile.fileUrl,
      wallet: {
        totalSubscribed: subscriptionWallet,
        businessTarget,
        totalDeducted: newDeductedWallet,
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
