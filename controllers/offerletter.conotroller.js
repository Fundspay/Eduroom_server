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
    // Fetch all users with associations
    const users = await model.User.findAll({
      where: { isDeleted: false },
      include: [
        {
          model: model.TeamManager,
          as: "teamManager",
          attributes: ["internshipStatus", "name", "email"],
        },
        {
          model: model.InternshipCertificate,
          attributes: ["isIssued", "courseId"],
        },
        {
          model: model.OfferLetter,
          attributes: ["issent", "fileUrl"],
        },
      ],
    });

    const userData = [];

    for (const user of users) {
      const courseDates = user.courseDates || {};
      const courseStatuses = user.courseStatuses || {};

      const coursesInfo = [];

      // Loop through all courses stored in user.courseDates
      for (const courseId of Object.keys(courseDates)) {
        const course = await model.Course.findByPk(courseId);
        if (!course) continue;

        const { startDate, endDate, started } = courseDates[courseId];
        let status = null;

        // 🔹 Status Priority
        if (user.teamManager?.internshipStatus) {
          status = { from: "teamManager", status: user.teamManager.internshipStatus };
        } else if (courseStatuses[courseId]) {
          status = { from: "userCourseStatus", status: courseStatuses[courseId] };
        } else if (started) {
          status = { from: "userCourseDates", status: "Started" };
        }

        coursesInfo.push({
          courseId: course.id,
          courseName: course.name,
          startDate: startDate || null,
          endDate: endDate || null,
          courseStatus: status,
        });
      }

      // Internship issued?
      const internshipIssued =
        user.InternshipCertificates?.length > 0
          ? user.InternshipCertificates.some((cert) => cert.isIssued)
          : null;

      // Offer letter
      const offerLetter = user.OfferLetters?.[0] || null;

      userData.push({
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        subscriptionWallet: user.subscriptionWallet,
        subscriptionLeft: user.subscriptionLeft,
        courses: coursesInfo, // 🔹 Array of courses
        internshipIssued,
        internshipStatus: user.teamManager?.internshipStatus || null,
        offerLetterSent: offerLetter ? offerLetter.issent : false,
        offerLetterFile: offerLetter ? offerLetter.fileUrl : null,
      });
    }

    return ReS(res, { success: true, data: userData }, 200);
  } catch (error) {
    console.error("List All Users Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.listAllUsers = listAllUsers;
