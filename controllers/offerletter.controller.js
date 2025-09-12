"use strict";
const { generateOfferLetter } = require("../utils/offerletter.service.js");
const { sendMail } = require("../middleware/mailer.middleware.js");
const model = require("../models/index.js");
const { User, TeamManager, InternshipCertificate, OfferLetter, Course, Domain } = require("../models/index.js");
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
    // Fetch users along with relevant associations
    const users = await User.findAll({
      include: [
        {
          model: TeamManager,
          as: "teamManager",
          attributes: ["id", "name", "internshipStatus"] // Use actual associated manager
        },
        {
          model: InternshipCertificate,
          attributes: ["id", "courseId", "certificateUrl", "isIssued", "issuedDate"]
        },
        {
          model: OfferLetter,
          attributes: ["id", "fileUrl", "issent", "startDate"]
        }
      ]
    });

    // Fetch all courses with domains
    const courses = await Course.findAll({
      attributes: ["id", "name", "duration", "businessTarget", "domainId"],
      include: [{ model: Domain, attributes: ["id", "name"] }]
    });

    // Fetch all team managers for the response
    const allTeamManagers = await TeamManager.findAll({
      where: { isDeleted: false },
      attributes: ["id", "managerId", "name", "email", "mobileNumber", "department", "position", "internshipStatus"]
    });

    const response = [];

    for (const user of users) {
      // Build course details
      const courseDetails = [];
      if (user.courseStatuses && typeof user.courseStatuses === "object") {
        for (const [courseId, status] of Object.entries(user.courseStatuses)) {
          const course = courses.find(c => c.id.toString() === courseId);
          courseDetails.push({
            courseId,
            courseName: course ? course.name : null,
            duration: course ? course.duration : null,
            businessTarget: course ? course.businessTarget : null,
            domainName: course && course.Domain ? course.Domain.name : null,
            status,
            startDate:
              user.courseDates && user.courseDates[courseId]
                ? user.courseDates[courseId].startDate
                : null,
            endDate:
              user.courseDates && user.courseDates[courseId]
                ? user.courseDates[courseId].endDate
                : null
          });
        }
      }

      // Internship info
      const internshipIssued =
        user.InternshipCertificates && user.InternshipCertificates.length > 0
          ? user.InternshipCertificates.some(cert => cert.isIssued)
          : null;

      // Team Manager info (using the exact associated manager)
      const teamManager = user.teamManager
        ? {
            id: user.teamManager.id,
            name: user.teamManager.name,
            internshipStatus: user.teamManager.internshipStatus
          }
        : null;

      // Offer Letter info
      const offerLetterSent =
        user.OfferLetters && user.OfferLetters.length > 0
          ? user.OfferLetters[0].issent
          : false;

      const offerLetterFile =
        user.OfferLetters && user.OfferLetters.length > 0
          ? user.OfferLetters[0].fileUrl
          : null;

      // ✅ Create Status record
      const statusRecord = await Status.create({
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phoneNumber: user.phoneNumber,
        collegeName: user.collegeName,
        subscriptionWallet: user.subscriptionWallet,
        subscriptionLeft: user.subscriptionLeft,
        courses: courseDetails,
        internshipIssued,
        internshipStatus: teamManager ? teamManager.internshipStatus : null,
        offerLetterSent,
        offerLetterFile,
        teamManager: teamManager ? teamManager.name : null
      });

      response.push({
        statusId: statusRecord.id,
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phoneNumber: user.phoneNumber,
        collegeName: user.collegeName,
        subscriptionWallet: user.subscriptionWallet,
        subscriptionLeft: user.subscriptionLeft,
        courses: courseDetails,
        internshipIssued,
        internshipStatus: teamManager ? teamManager.internshipStatus : null,
        offerLetterSent,
        offerLetterFile,
        teamManager: teamManager ? teamManager.name : null
      });
    }

    return ReS(res, {
      success: true,
      data: response,
      teamManagers: {
        total: allTeamManagers.length,
        list: allTeamManagers
      }
    }, 200);

  } catch (err) {
    console.error("Error in listAllUsers:", err);
    return ReE(res, err.message, 500);
  }
};

module.exports.listAllUsers = listAllUsers;
