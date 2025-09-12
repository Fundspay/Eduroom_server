"use strict";
const { generateOfferLetter } = require("../utils/offerletter.service");
const { sendMail } = require("../middleware/mailer.middleware");
const model = require("../models");
const { User, TeamManager, Course, InternshipCertificate, OfferLetter } = require("../models");

// Controller: Send Offer Letter to User Email
const sendOfferLetter = async (req, res) => {

  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });

    // Fetch user
    const user = await model.User.findOne({ where: { id: userId, isDeleted: false } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (!user.email) {
      return res.status(400).json({ success: false, message: "User has no email" });
    }

    // Generate Offer Letter (PDF uploaded to S3 + DB saved)
    const offerLetter = await generateOfferLetter(userId);

    // Build email content
    const subject = "Your Internship Offer Letter - Fundsroom Investment Services";
    const html = `
      <p>Dear ${user.fullName || user.firstName},</p>
      <p>Congratulations! Please find attached your <b>Offer Letter</b> for the internship at <b>Fundsroom Investment Services</b>.</p>
      <p>You can also access it anytime using the following link:</p>
      <p><a href="${offerLetter.fileUrl}" target="_blank">${offerLetter.fileUrl}</a></p>
      <br/>
      <p>Best Regards,<br/>Fundsroom HR Team</p>
    `;

    // Send Email
    const mailResult = await sendMail(user.email, subject, html);

    if (!mailResult.success) {
      return res.status(500).json({ success: false, message: "Failed to send email", error: mailResult.error });
    }
    await model.OfferLetter.update(
      {
        issent: true,
        updatedAt: new Date()
      },
      { where: { id: offerLetter.id } }
    );

    return res.status(200).json({
      success: true,
      message: "Offer Letter sent successfully",
      fileUrl: offerLetter.fileUrl,
    });

  } catch (error) {
    console.error(" sendOfferLetter error:", error);
    return res.status(500).json({ success: false, message: "Server error", error });
  }
};

module.exports = { sendOfferLetter };



const listAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      include: [
        {
          model: TeamManager,
          as: "teamManager",
          attributes: ["id", "name", "position", "internshipStatus"]
        },
        {
          model: InternshipCertificate,
          attributes: ["id", "courseId", "isIssued", "certificateUrl", "issuedDate"]
        },
        {
          model: OfferLetter,
          attributes: ["id", "issent", "startDate", "fileUrl", "position"]
        }
      ]
    });

    const response = [];

    for (let user of users) {
      let courseStatusInfo = null;
      let selectedCourseId = null;
      let selectedCourseName = null;
      let internshipIssued = null;

      // 🔹 Check Internship Certificate first
      if (user.InternshipCertificates && user.InternshipCertificates.length > 0) {
        const cert = user.InternshipCertificates[0]; // take first (or latest if you want)
        selectedCourseId = cert.courseId;
        internshipIssued = cert.isIssued;
        const course = await Course.findByPk(cert.courseId, { attributes: ["id", "name"] });
        selectedCourseName = course ? course.name : null;
        courseStatusInfo = { from: "internship", status: cert.isIssued ? "completed" : "pending" };
      } else {
        // 🔹 Check User courseStatuses JSON
        if (user.courseStatuses && Object.keys(user.courseStatuses).length > 0) {
          for (let [courseId, status] of Object.entries(user.courseStatuses)) {
            selectedCourseId = courseId;
            const course = await Course.findByPk(courseId, { attributes: ["id", "name"] });
            selectedCourseName = course ? course.name : null;
            courseStatusInfo = { from: "userCourseStatus", status };
            break; // take first found
          }
        } else {
          // 🔹 Fallback: if isStarted true (fake info)
          if (user.isStarted) {
            courseStatusInfo = { from: "userStarted", status: "started" };
          }
        }
      }

      // 🔹 Build user response
      response.push({
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        subscriptionWallet: user.subscriptionWallet,
        subscriptionLeft: user.subscriptionLeft,
        courseId: selectedCourseId,
        courseName: selectedCourseName,
        courseStatus: courseStatusInfo,
        internshipIssued, // ✅ internship certificate issued or not
        internshipStatus: user.teamManager ? user.teamManager.internshipStatus : null,
        offerLetterSent: user.OfferLetters?.length > 0 ? user.OfferLetters[0].issent : false,
        offerLetterFile: user.OfferLetters?.length > 0 ? user.OfferLetters[0].fileUrl : null
      });
    }

    return res.status(200).json({ success: true, data: response });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { listAllUsers };

