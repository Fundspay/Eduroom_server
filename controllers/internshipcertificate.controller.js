const { generateInternshipCertificate } = require("../utils/internshipcertificate.service");
const { sendMail } = require("../middleware/mailer.middleware");
const model = require("../models");
const sequelize = model.sequelize;
const { mergePDFsAndUpload } = require("../utils/mergePDFs.service");
const { generateInternshipReport } = require("../utils/internshipreport1.service");
const { generateInternshipDetailsReport } = require("../utils/internshipreport2.service");
const  { generateSessionReport } = require("../utils/internshipreport3.service");
const  { generateMCQCaseStudyReport } = require("../utils/internshipreport4.service")
const {finalpageinternshipreport} = require("../utils/internshipreport5.service");
const { ReS, ReE } = require("../utils/util.service");


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
      lock: transaction.LOCK.UPDATE,
    });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 🔹 Fetch course
    const course = await model.Course.findOne({
      where: { id: courseId, isDeleted: false },
      transaction,
    });
    if (!course) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    // 🔹 CHECK END DATE
    const userCourseData = user.courseDates?.[courseId];
    if (userCourseData?.endDate) {
      const currentDate = new Date();
      const courseEndDate = new Date(userCourseData.endDate);
      if (currentDate < courseEndDate) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Certificate cannot be generated yet. The course end date has not been reached.",
          endDate: userCourseData.endDate,
          courseName: userCourseData.courseName,
        });
      }
    }

    // 🔹 Check if certificate already exists
    let certificate = await model.InternshipCertificate.findOne({
      where: { userId, courseId },
      transaction,
    });

    const alreadyIssued = certificate && certificate.isIssued;

    // ─────────────────────────────────────────────
    // 🔹 FUNDSWEB USER PATH
    // ─────────────────────────────────────────────
    if (user.userType === "fundsweb") {

      const fundsWebTarget   = parseInt(course?.fundsWebTarget || 0, 10);
      const fundsWebAchieved = parseInt(user.fundsWebTargets?.[courseId] ?? 0, 10);
      const fundsWebDeducted = parseInt(user.fundsWebDeductedTargets?.[courseId] ?? 0, 10);
      const fundsWebLeft     = Math.max(0, fundsWebAchieved - fundsWebDeducted);
      const fundsWebTargetMet = fundsWebTarget > 0 && fundsWebLeft >= fundsWebTarget;

      // 🔥 Skip wallet check if already issued
      if (!alreadyIssued) {
        if (!fundsWebTargetMet) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: "FundsWeb subscription target not met for this course.",
            wallet: {
              fundsWebAchieved,
              fundsWebDeducted,
              fundsWebLeft,
              fundsWebTarget,
            },
          });
        }
      }

      // 🔹 Deduct only on first-time issuance
      if (!certificate) {
        const updatedFundsWebDeducted = { ...(user.fundsWebDeductedTargets || {}) };
        updatedFundsWebDeducted[courseId] = fundsWebDeducted + fundsWebTarget;
        user.fundsWebDeductedTargets = updatedFundsWebDeducted;
        user.changed("fundsWebDeductedTargets", true);

        await user.save({
          fields: ["fundsWebDeductedTargets"],
          transaction,
        });
      }

      // 🔹 Generate certificate — ✅ ONLY LINE CHANGED
      const certificateFile = await generateInternshipCertificateFundsWeb(userId, courseId);
      if (!certificateFile?.fileUrl) {
        await transaction.rollback();
        return res.status(500).json({
          success: false,
          message: "Certificate generation failed: fileUrl is missing",
        });
      }

      // 🔹 Save or update certificate
      if (certificate) {
        certificate.certificateUrl = certificateFile.fileUrl;
        certificate.isIssued       = true;
        certificate.issuedDate     = new Date();
        await certificate.save({ transaction });
      } else {
        certificate = await model.InternshipCertificate.create(
          {
            userId,
            courseId,
            certificateUrl: certificateFile.fileUrl,
            isIssued:       true,
            issuedDate:     new Date(),
            deductedWallet: fundsWebTarget,
          },
          { transaction }
        );
      }

      // 🔹 Send email
      const subject = `Your Internship Certificate - ${course.name}`;
      const html = `
        <p>Dear ${user.fullName || user.firstName},</p>
        <p>Here is your <b>Internship Certificate</b> for completing the <b>${course.name}</b> course.</p>
        <p>Access it here:</p>
        <p><a href="${certificateFile.fileUrl}" target="_blank">${certificateFile.fileUrl}</a></p>
        <p>Congratulations on your achievement!</p>
        <br/>
        <p>Best Regards,<br/>${course.name} Team</p>
      `;
      await sendMail(user.email, subject, html);

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: "Internship Certificate generated and sent successfully",
        certificateUrl: certificateFile.fileUrl,
        deductionType: "fundsWebTarget",
        wallet: {
          fundsWebAchieved,
          fundsWebDeducted: fundsWebDeducted + fundsWebTarget,
          fundsWebLeft: fundsWebLeft - fundsWebTarget,
          fundsWebTarget,
        },
      });
    }

    // ─────────────────────────────────────────────
    // 🔹 FUNDSAUDIT USER PATH — existing logic
    // ─────────────────────────────────────────────

    // 🔹 Get targets
    const userTargetObj         = user.businessTargets?.[courseId];
    const businessTarget        = userTargetObj?.target !== undefined
      ? parseInt(userTargetObj.target, 10)
      : parseInt(course?.businessTarget || 0, 10);
    const followerTarget        = parseInt(course?.followerTarget || 0, 10);
    const reviewAndRatingTarget = parseInt(course?.reviewAndRatingTarget || 0, 10);
    const postTarget            = parseInt(course?.postTarget || 0, 10);

    // 🔹 Wallet info
    const subscriptionWallet = parseInt(user.subscriptionWallet || 0, 10);
    let newDeductedWallet    = parseInt(user.subscriptiondeductedWallet || 0, 10);
    let newSubscriptionLeft  = Math.max(0, subscriptionWallet - newDeductedWallet);

    // 🔹 Check which path qualifies
    const businessTargetMet = businessTarget !== null && businessTarget > 0
      ? newSubscriptionLeft >= businessTarget
      : newSubscriptionLeft > 0;

    const threeTargetsMet = newSubscriptionLeft >= (followerTarget + reviewAndRatingTarget + postTarget)
      && (followerTarget + reviewAndRatingTarget + postTarget) > 0;

    // 🔥 Skip wallet check if already issued
    if (!alreadyIssued) {
      if (!businessTargetMet && !threeTargetsMet) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Insufficient subscription wallet. Neither business target nor the 3 marketing targets are met.",
          wallet: {
            totalSubscribed: subscriptionWallet,
            totalDeducted: newDeductedWallet,
            subscriptionLeft: newSubscriptionLeft,
            businessTarget,
            followerTarget,
            reviewAndRatingTarget,
            postTarget,
          },
        });
      }
    }

    // 🔹 Decide how much to deduct — businessTarget takes priority
    const deductionAmount = businessTargetMet
      ? (businessTarget || subscriptionWallet)
      : (followerTarget + reviewAndRatingTarget + postTarget);

    const deductionType = businessTargetMet ? "businessTarget" : "threeTargets";

    // 🔹 Deduct wallet only if first-time issuance
    if (!certificate) {
      newDeductedWallet  += deductionAmount;
      newSubscriptionLeft = subscriptionWallet - newDeductedWallet;

      user.subscriptiondeductedWallet = newDeductedWallet;
      user.subscriptionLeft           = newSubscriptionLeft;

      await user.save({
        fields: ["subscriptiondeductedWallet", "subscriptionLeft"],
        transaction,
      });
    }

    // 🔹 Generate certificate
    const certificateFile = await generateInternshipCertificate(userId, courseId);
    if (!certificateFile?.fileUrl) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: "Certificate generation failed: fileUrl is missing",
      });
    }

    // 🔹 Save or update certificate
    if (certificate) {
      certificate.certificateUrl = certificateFile.fileUrl;
      certificate.isIssued       = true;
      certificate.issuedDate     = new Date();
      await certificate.save({ transaction });
    } else {
      certificate = await model.InternshipCertificate.create(
        {
          userId,
          courseId,
          certificateUrl: certificateFile.fileUrl,
          isIssued:       true,
          issuedDate:     new Date(),
          deductedWallet: deductionAmount,
        },
        { transaction }
      );
    }

    // 🔹 Send email
    const subject = `Your Internship Certificate - ${course.name}`;
    const html = `
      <p>Dear ${user.fullName || user.firstName},</p>
      <p>Here is your <b>Internship Certificate</b> for completing the <b>${course.name}</b> course.</p>
      <p>Access it here:</p>
      <p><a href="${certificateFile.fileUrl}" target="_blank">${certificateFile.fileUrl}</a></p>
      <p>Congratulations on your achievement!</p>
      <br/>
      <p>Best Regards,<br/>${course.name} Team</p>
    `;
    await sendMail(user.email, subject, html);

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Internship Certificate generated and sent successfully",
      certificateUrl: certificateFile.fileUrl,
      deductionType,
      wallet: {
        totalSubscribed: subscriptionWallet,
        deductionAmount,
        totalDeducted: newDeductedWallet,
        subscriptionLeft: newSubscriptionLeft,
        businessTarget,
        followerTarget,
        reviewAndRatingTarget,
        postTarget,
      },
    });

  } catch (error) {
    await transaction.rollback();
    console.error("createAndSendInternshipCertificate error:", error);
    return res.status(500).json({ success: false, message: "Server error", error });
  }
};

module.exports.createAndSendInternshipCertificate = createAndSendInternshipCertificate;

const generateMergedInternshipReportAndEmail = async (req, res) => {
  try {
    // 1️⃣ Extract and validate userId and courseId from params
    const userId = Number(req.params.userId);
    const courseId = Number(req.params.courseId);

    if (!userId || isNaN(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or missing userId" });
    }
    if (!courseId || isNaN(courseId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or missing courseId" });
    }

    // 2️⃣ Fetch user and validate
    const user = await model.User.findOne({
      where: { id: userId, isDeleted: false },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (!user.email) {
      return res
        .status(400)
        .json({ success: false, message: "User has no email" });
    }

    const userEmail = user.email;
    const internName = user.fullName || user.firstName || "Intern";

    // 3️⃣ Generate PDFs
    // ✅ Pass correct arguments per generator's expected signature
    const coverPdf = await generateInternshipReport(userId);
    const detailsPdf = await generateInternshipDetailsReport(userId);
    const sessionPdf = await generateSessionReport(userId, { courseId });
    const mcqCaseStudyPdf = await generateMCQCaseStudyReport({
      userId,
      courseId,
    });
    // ✅ NEW: final summary table page
    const summaryPdf = await finalpageinternshipreport({ userId, courseId });

    // 4️⃣ Merge PDFs and upload to S3
    const merged = await mergePDFsAndUpload(userId, [
      coverPdf,
      detailsPdf,
      sessionPdf,
      mcqCaseStudyPdf,
      summaryPdf, // ✅ added as last page
    ]);

    // 5️⃣ Send email with the merged PDF link
    const emailHtml = `
      <p>Hi ${internName},</p>
      <p>Your internship report has been generated successfully.</p>
      <p>You can download it from the link below:</p>
      <p><a href="${merged.fileUrl}">${merged.fileUrl}</a></p>
      <p>Regards,<br/>EduRoom Team</p>
    `;

    const mailResult = await sendMail(
      userEmail,
      "Your Internship Report",
      emailHtml
    );

    if (!mailResult.success) {
      console.error("Email failed to send:", mailResult.error);
      return res.status(500).json({
        success: false,
        message: "Merged PDF generated but email sending failed",
        fileUrl: merged.fileUrl,
      });
    }

    // 6️⃣ Success response
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

module.exports.generateMergedInternshipReportAndEmail =
  generateMergedInternshipReportAndEmail;


  var fetchAllInternshipCertificates = async (req, res) => {
  try {
    const certificates = await model.InternshipCertificate.findAll({
      include: [
        {
          model: model.User,
          attributes: ["id", "firstName", "lastName", "email"]
        },
        {
          model: model.Course,
          attributes: ["id", "name", "description"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    return ReS(res, { success: true, data: certificates }, 200);
  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchAllInternshipCertificates = fetchAllInternshipCertificates;


// const { generateInternshipCertificate } = require("../utils/internshipcertificate.service");
// const { sendMail } = require("../middleware/mailer.middleware");
// const model = require("../models");
// const sequelize = model.sequelize;
// const { mergePDFsAndUpload } = require("../utils/mergePDFs.service");
// const { generateInternshipReport } = require("../utils/internshipreport1.service");
// const { generateInternshipDetailsReport } = require("../utils/internshipreport2.service");
// const  { generateSessionReport } = require("../utils/internshipreport3.service");
// const  { generateMCQCaseStudyReport } = require("../utils/internshipreport4.service")
// const {finalpageinternshipreport} = require("../utils/internshipreport5.service");
// const { ReS, ReE } = require("../utils/util.service");


// const createAndSendInternshipCertificate = async (req, res) => {
//   const transaction = await sequelize.transaction();
//   try {
//     const { userId, courseId } = req.body;

//     if (!userId || !courseId) {
//       await transaction.rollback();
//       return res.status(400).json({ success: false, message: "userId and courseId are required" });
//     }

//     // 🔹 Fetch user
//     const user = await model.User.findOne({
//       where: { id: userId, isDeleted: false },
//       transaction,
//       lock: transaction.LOCK.UPDATE,
//     });
//     if (!user) {
//       await transaction.rollback();
//       return res.status(404).json({ success: false, message: "User not found" });
//     }

//     // 🔹 Fetch course
//     const course = await model.Course.findOne({
//       where: { id: courseId, isDeleted: false },
//       transaction,
//     });
//     if (!course) {
//       await transaction.rollback();
//       return res.status(404).json({ success: false, message: "Course not found" });
//     }

//     // 🔹 CHECK END DATE
//     const userCourseData = user.courseDates?.[courseId];
//     if (userCourseData?.endDate) {
//       const currentDate = new Date();
//       const courseEndDate = new Date(userCourseData.endDate);
//       if (currentDate < courseEndDate) {
//         await transaction.rollback();
//         return res.status(400).json({
//           success: false,
//           message: "Certificate cannot be generated yet. The course end date has not been reached.",
//           endDate: userCourseData.endDate,
//           courseName: userCourseData.courseName,
//         });
//       }
//     }

//     // 🔹 Get targets
//     const userTargetObj         = user.businessTargets?.[courseId];
//     const businessTarget        = userTargetObj?.target !== undefined
//       ? parseInt(userTargetObj.target, 10)
//       : parseInt(course?.businessTarget || 0, 10);
//     const followerTarget        = parseInt(course?.followerTarget || 0, 10);
//     const reviewAndRatingTarget = parseInt(course?.reviewAndRatingTarget || 0, 10);
//     const postTarget            = parseInt(course?.postTarget || 0, 10);
//     const fundswebTarget        = parseInt(course?.fundswebTarget || 0, 10);   // ✅

//     const isfundswebUser    = user.userType === "fundsweb";
//     const isFundsAuditUser  = user.userType === "fundsaudit";

//     // ─────────────────────────────────────────────
//     // 🔹 fundsweb USER PATH
//     // ─────────────────────────────────────────────
//     if (isfundswebUser) {
//       const fundswebAchieved   = parseInt(user.fundswebTargets?.[courseId] ?? 0, 10);
//       const fundswebDeducted   = parseInt(user.fundswebDeductedTargets?.[courseId] ?? 0, 10);
//       const fundswebLeft       = Math.max(0, fundswebAchieved - fundswebDeducted);
//       const fundswebTargetMet  = fundswebTarget > 0 && fundswebLeft >= fundswebTarget;

//       if (!fundswebTargetMet) {
//         await transaction.rollback();
//         return res.status(400).json({
//           success: false,
//           message: "fundsweb subscription target not met for this course.",
//           wallet: {
//             fundswebAchieved,
//             fundswebDeducted,
//             fundswebLeft,
//             fundswebTarget,
//           },
//         });
//       }

//       // 🔹 Check if certificate already exists
//       let certificate = await model.InternshipCertificate.findOne({
//         where: { userId, courseId },
//         transaction,
//       });

//       // 🔹 Deduct only on first-time issuance
//       if (!certificate) {
//         const updatedfundswebDeducted = { ...(user.fundswebDeductedTargets || {}) };
//         updatedfundswebDeducted[courseId] = fundswebDeducted + fundswebTarget;
//         user.fundswebDeductedTargets = updatedfundswebDeducted;
//         user.changed("fundswebDeductedTargets", true);

//         await user.save({
//           fields: ["fundswebDeductedTargets"],
//           transaction,
//         });
//       }

//       // 🔹 Generate certificate
//       const certificateFile = await generateInternshipCertificate(userId, courseId);
//       if (!certificateFile?.fileUrl) {
//         await transaction.rollback();
//         return res.status(500).json({
//           success: false,
//           message: "Certificate generation failed: fileUrl is missing",
//         });
//       }

//       // 🔹 Save or update certificate
//       if (certificate) {
//         certificate.certificateUrl = certificateFile.fileUrl;
//         certificate.isIssued       = true;
//         certificate.issuedDate     = new Date();
//         await certificate.save({ transaction });
//       } else {
//         certificate = await model.InternshipCertificate.create(
//           {
//             userId,
//             courseId,
//             certificateUrl: certificateFile.fileUrl,
//             isIssued:       true,
//             issuedDate:     new Date(),
//             deductedWallet: fundswebTarget,
//           },
//           { transaction }
//         );
//       }

//       // 🔹 Send email
//       const subject = `Your Internship Certificate - ${course.name}`;
//       const html = `
//         <p>Dear ${user.fullName || user.firstName},</p>
//         <p>Here is your <b>Internship Certificate</b> for completing the <b>${course.name}</b> course.</p>
//         <p>Access it here:</p>
//         <p><a href="${certificateFile.fileUrl}" target="_blank">${certificateFile.fileUrl}</a></p>
//         <p>Congratulations on your achievement!</p>
//         <br/>
//         <p>Best Regards,<br/>${course.name} Team</p>
//       `;
//       await sendMail(user.email, subject, html);

//       await transaction.commit();

//       return res.status(200).json({
//         success: true,
//         message: "Internship Certificate generated and sent successfully",
//         certificateUrl: certificateFile.fileUrl,
//         deductionType: "fundswebTarget",
//         wallet: {
//           fundswebAchieved,
//           fundswebDeducted: fundswebDeducted + fundswebTarget,
//           fundswebLeft: fundswebLeft - fundswebTarget,
//           fundswebTarget,
//         },
//       });
//     }

//     // ─────────────────────────────────────────────
//     // 🔹 FUNDSAUDIT USER PATH (existing logic unchanged)
//     // ─────────────────────────────────────────────
//     const subscriptionWallet = parseInt(user.subscriptionWallet || 0, 10);
//     let newDeductedWallet    = parseInt(user.subscriptiondeductedWallet || 0, 10);
//     let newSubscriptionLeft  = Math.max(0, subscriptionWallet - newDeductedWallet);

//     const businessTargetMet = newSubscriptionLeft >= businessTarget && businessTarget > 0;
//     const threeTargetsMet   = newSubscriptionLeft >= (followerTarget + reviewAndRatingTarget + postTarget)
//                               && (followerTarget + reviewAndRatingTarget + postTarget) > 0;

//     if (!businessTargetMet && !threeTargetsMet) {
//       await transaction.rollback();
//       return res.status(400).json({
//         success: false,
//         message: "Insufficient subscription wallet. Neither business target nor the 3 marketing targets are met.",
//         wallet: {
//           totalSubscribed: subscriptionWallet,
//           totalDeducted: newDeductedWallet,
//           subscriptionLeft: newSubscriptionLeft,
//           businessTarget,
//           followerTarget,
//           reviewAndRatingTarget,
//           postTarget,
//         },
//       });
//     }

//     const deductionAmount = businessTargetMet
//       ? businessTarget
//       : (followerTarget + reviewAndRatingTarget + postTarget);

//     const deductionType = businessTargetMet ? "businessTarget" : "threeTargets";

//     let certificate = await model.InternshipCertificate.findOne({
//       where: { userId, courseId },
//       transaction,
//     });

//     if (!certificate) {
//       newDeductedWallet  += deductionAmount;
//       newSubscriptionLeft = subscriptionWallet - newDeductedWallet;

//       user.subscriptiondeductedWallet = newDeductedWallet;
//       user.subscriptionLeft           = newSubscriptionLeft;

//       await user.save({
//         fields: ["subscriptiondeductedWallet", "subscriptionLeft"],
//         transaction,
//       });
//     }

//     const certificateFile = await generateInternshipCertificate(userId, courseId);
//     if (!certificateFile?.fileUrl) {
//       await transaction.rollback();
//       return res.status(500).json({
//         success: false,
//         message: "Certificate generation failed: fileUrl is missing",
//       });
//     }

//     if (certificate) {
//       certificate.certificateUrl = certificateFile.fileUrl;
//       certificate.isIssued       = true;
//       certificate.issuedDate     = new Date();
//       await certificate.save({ transaction });
//     } else {
//       certificate = await model.InternshipCertificate.create(
//         {
//           userId,
//           courseId,
//           certificateUrl: certificateFile.fileUrl,
//           isIssued:       true,
//           issuedDate:     new Date(),
//           deductedWallet: deductionAmount,
//         },
//         { transaction }
//       );
//     }

//     const subject = `Your Internship Certificate - ${course.name}`;
//     const html = `
//       <p>Dear ${user.fullName || user.firstName},</p>
//       <p>Here is your <b>Internship Certificate</b> for completing the <b>${course.name}</b> course.</p>
//       <p>Access it here:</p>
//       <p><a href="${certificateFile.fileUrl}" target="_blank">${certificateFile.fileUrl}</a></p>
//       <p>Congratulations on your achievement!</p>
//       <br/>
//       <p>Best Regards,<br/>${course.name} Team</p>
//     `;
//     await sendMail(user.email, subject, html);

//     await transaction.commit();

//     return res.status(200).json({
//       success: true,
//       message: "Internship Certificate generated and sent successfully",
//       certificateUrl: certificateFile.fileUrl,
//       deductionType,
//       wallet: {
//         totalSubscribed: subscriptionWallet,
//         deductionAmount,
//         totalDeducted: newDeductedWallet,
//         subscriptionLeft: newSubscriptionLeft,
//         businessTarget,
//         followerTarget,
//         reviewAndRatingTarget,
//         postTarget,
//       },
//     });

//   } catch (error) {
//     await transaction.rollback();
//     console.error("createAndSendInternshipCertificate error:", error);
//     return res.status(500).json({ success: false, message: "Server error", error });
//   }
// };

// module.exports.createAndSendInternshipCertificate = createAndSendInternshipCertificate;

// const generateMergedInternshipReportAndEmail = async (req, res) => {
//   try {
//     // 1️⃣ Extract and validate userId and courseId from params
//     const userId = Number(req.params.userId);
//     const courseId = Number(req.params.courseId);

//     if (!userId || isNaN(userId)) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Invalid or missing userId" });
//     }
//     if (!courseId || isNaN(courseId)) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Invalid or missing courseId" });
//     }

//     // 2️⃣ Fetch user and validate
//     const user = await model.User.findOne({
//       where: { id: userId, isDeleted: false },
//     });

//     if (!user) {
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     }
//     if (!user.email) {
//       return res
//         .status(400)
//         .json({ success: false, message: "User has no email" });
//     }

//     const userEmail = user.email;
//     const internName = user.fullName || user.firstName || "Intern";

//     // 3️⃣ Generate PDFs
//     // ✅ Pass correct arguments per generator's expected signature
//     const coverPdf = await generateInternshipReport(userId);
//     const detailsPdf = await generateInternshipDetailsReport(userId);
//     const sessionPdf = await generateSessionReport(userId, { courseId });
//     const mcqCaseStudyPdf = await generateMCQCaseStudyReport({
//       userId,
//       courseId,
//     });
//     // ✅ NEW: final summary table page
//     const summaryPdf = await finalpageinternshipreport({ userId, courseId });

//     // 4️⃣ Merge PDFs and upload to S3
//     const merged = await mergePDFsAndUpload(userId, [
//       coverPdf,
//       detailsPdf,
//       sessionPdf,
//       mcqCaseStudyPdf,
//       summaryPdf, // ✅ added as last page
//     ]);

//     // 5️⃣ Send email with the merged PDF link
//     const emailHtml = `
//       <p>Hi ${internName},</p>
//       <p>Your internship report has been generated successfully.</p>
//       <p>You can download it from the link below:</p>
//       <p><a href="${merged.fileUrl}">${merged.fileUrl}</a></p>
//       <p>Regards,<br/>EduRoom Team</p>
//     `;

//     const mailResult = await sendMail(
//       userEmail,
//       "Your Internship Report",
//       emailHtml
//     );

//     if (!mailResult.success) {
//       console.error("Email failed to send:", mailResult.error);
//       return res.status(500).json({
//         success: false,
//         message: "Merged PDF generated but email sending failed",
//         fileUrl: merged.fileUrl,
//       });
//     }

//     // 6️⃣ Success response
//     return res.status(200).json({
//       success: true,
//       message: "Merged internship report generated and emailed successfully",
//       fileUrl: merged.fileUrl,
//     });
//   } catch (error) {
//     console.error("Error generating or emailing merged report:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to generate or email merged internship report",
//       error: error.message,
//     });
//   }
// };

// module.exports.generateMergedInternshipReportAndEmail =
//   generateMergedInternshipReportAndEmail;


//   var fetchAllInternshipCertificates = async (req, res) => {
//   try {
//     const certificates = await model.InternshipCertificate.findAll({
//       include: [
//         {
//           model: model.User,
//           attributes: ["id", "firstName", "lastName", "email"]
//         },
//         {
//           model: model.Course,
//           attributes: ["id", "name", "description"]
//         }
//       ],
//       order: [["createdAt", "DESC"]]
//     });

//     return ReS(res, { success: true, data: certificates }, 200);
//   } catch (error) {
//     return ReE(res, error.message, 500);
//   }
// };

// module.exports.fetchAllInternshipCertificates = fetchAllInternshipCertificates;