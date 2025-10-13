const { generateInternshipCertificate } = require("../utils/internshipcertificate.service");
const { sendMail } = require("../middleware/mailer.middleware");
const model = require("../models");
const sequelize = model.sequelize;
const { mergePDFsAndUpload } = require("../utils/mergePDFs.service");
const { generateInternshipReport } = require("../utils/internshipreport1.service");
const { generateInternshipDetailsReport } = require("../utils/internshipreport2.service");
const  { generateSessionReport } = require("../utils/internshipreport3.service");
const  { generateMCQCaseStudyReport } = require("../utils/internshipreport4.service")



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

    // 🔹 Get business target
    const userTarget = user.businessTargets?.[courseId];
    const rawTarget = parseInt(userTarget !== undefined ? userTarget : course?.businessTarget || 0, 10);
    const businessTarget = Math.max(0, rawTarget);

    // 🔹 Wallet info
    const subscriptionWallet = parseInt(user.subscriptionWallet || 0, 10); // total earned
    let newDeductedWallet = parseInt(user.subscriptiondeductedWallet || 0, 10);
    let newSubscriptionLeft = Math.max(0, subscriptionWallet - newDeductedWallet);

    // 🔹 Check if certificate already exists
    let certificate = await model.InternshipCertificate.findOne({ where: { userId, courseId }, transaction });

    // 🔹 Deduct wallet only if first-time issuance
    if (!certificate) {
      if (newSubscriptionLeft < businessTarget) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Insufficient subscription wallet, business target not met",
          wallet: {
            totalSubscribed: subscriptionWallet,
            businessTarget,
            totalDeducted: newDeductedWallet,
            subscriptionLeft: newSubscriptionLeft
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
    }

    // 🔹 Always generate a fresh certificate
    const certificateFile = await generateInternshipCertificate(userId, courseId);
    if (!certificateFile?.fileUrl) {
      await transaction.rollback();
      return res.status(500).json({ success: false, message: "Certificate generation failed: fileUrl is missing" });
    }

    // 🔹 If certificate exists, update it; else create new
    if (certificate) {
      certificate.certificateUrl = certificateFile.fileUrl;
      certificate.isIssued = true;
      certificate.issuedDate = new Date();
      await certificate.save({ transaction });
    } else {
      certificate = await model.InternshipCertificate.create({
        userId,
        courseId,
        certificateUrl: certificateFile.fileUrl,
        isIssued: true,
        issuedDate: new Date(),
        deductedWallet: businessTarget
      }, { transaction });
    }

    // 🔹 Send email
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
      message: "Internship Certificate generated successfully",
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

const generateMergedInternshipReportAndEmail = async (req, res) => {
  const { userId, courseId } = req.params;

  if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });
  if (!courseId) return res.status(400).json({ success: false, message: "Missing courseId" });

  try {
    // 1️⃣ Fetch user and email
    const user = await model.User.findOne({ where: { id: userId, isDeleted: false } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!user.email) return res.status(400).json({ success: false, message: "User has no email" });

    const userEmail = user.email;

    // 2️⃣ Generate all PDFs (pass courseId to relevant reports)
    const coverPdf = await generateInternshipReport(userId, courseId);
    const detailsPdf = await generateInternshipDetailsReport(userId, courseId);
    const sessionPdf = await generateSessionReport(userId, courseId);
    const mcqCaseStudyPdf = await generateMCQCaseStudyReport(userId, courseId);

    // 3️⃣ Merge PDFs and upload to S3
    const merged = await mergePDFsAndUpload(userId, [coverPdf, detailsPdf, sessionPdf, mcqCaseStudyPdf]);

    // 4️⃣ Send email using your mailer
    const emailHtml = `
      <p>Hi ${user.fullName || ""},</p>
      <p>Your internship report has been generated successfully.</p>
      <p>You can download it from the link below:</p>
      <p><a href="${merged.fileUrl}">${merged.fileUrl}</a></p>
      <p>Regards,<br/>EduRoom Team</p>
    `;

    const mailResult = await sendMail(userEmail, "Your Internship Report", emailHtml);

    if (!mailResult.success) {
      console.error("Email failed to send:", mailResult.error);
      return res.status(500).json({
        success: false,
        message: "Merged PDF generated but email sending failed",
        fileUrl: merged.fileUrl,
      });
    }

    // 5️⃣ Return success
    return res.status(200).json({
      success: true,
      message: "Merged internship report generated and emailed successfully",
      fileUrl: merged.fileUrl,
    });

  } catch (error) {
    console.error("Error generating or emailing merged report:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate or email merged internship report",
      error: error.message,
    });
  }
};

module.exports.generateMergedInternshipReportAndEmail = generateMergedInternshipReportAndEmail;
