"use strict";
const { generateOfferLetter } = require("../utils/offerletter.service");
const { sendMail } = require("../middleware/mailer.middleware");
const model = require("../models");
const { User, TeamManager, Course, InternshipCertificate, OfferLetter } = require("../models");
const { ReE, ReS } = require("../utils/util.service.js");


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
          model: Course,
          attributes: ["id", "name", "duration", "domainId"],
          include: [
            {
              model: Domain,
              attributes: ["id", "name"]
            }
          ]
        },
        {
          model: TeamManager,
          as: "teamManager",
          attributes: ["id", "name", "email", "mobileNumber", "internshipStatus"]
        }
      ]
    });

    const formatted = users.map((user) => {
      return {
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phoneNumber: user.phoneNumber,
        collegeName: user.collegeName,

        // 🔹 Courses + Domain + Duration
        courses: user.Courses?.map((course) => ({
          courseId: course.id,
          courseName: course.name,
          duration: course.duration,
          domainName: course.Domain ? course.Domain.name : null,
          status: user.courseStatuses ? user.courseStatuses[course.id] : null,
          startDate: user.courseDates ? user.courseDates[course.id]?.startDate : null,
          endDate: user.courseDates ? user.courseDates[course.id]?.endDate : null
        })) || [],

        // 🔹 Team Manager Info
        teamManager: user.teamManager
          ? {
              id: user.teamManager.id,
              name: user.teamManager.name,
              email: user.teamManager.email,
              mobileNumber: user.teamManager.mobileNumber,
              internshipStatus: user.teamManager.internshipStatus
            }
          : null,

        subscriptionWallet: user.subscriptionWallet,
        subscriptionLeft: user.subscriptionLeft
      };
    });

    return res.status(200).json({
      success: true,
      totalUsers: formatted.length,
      data: formatted
    });
  } catch (err) {
    console.error("Error in listAllUsers:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { listAllUsers };
