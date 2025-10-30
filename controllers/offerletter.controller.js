"use strict";
const { generateOfferLetter } = require("../utils/offerletter.service.js");
const { generateCertificate } = require("../utils/certificate.service.js");
const { generateInternshipDetailsReport } = require("../utils/internshipreport2.service.js");
const {generateSessionReport} = require("../utils/internshipreport3.service.js");
const {generateMCQCaseStudyReport} = require("../utils/internshipreport4.service.js");
const { sendMail } = require("../middleware/mailer.middleware.js");
const model = require("../models/index.js");
const { User, TeamManager, InternshipCertificate, OfferLetter, Course, Domain, RaiseQuery, Status } = require("../models/index.js");
const { ReE, ReS } = require("../utils/util.service.js");
const moment = require("moment");
const { Op } = require("sequelize");
const { CaseStudyResult, QuestionModel } = require("../models");


// Controller: Send Offer Letter to User Email
const sendOfferLetter = async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    if (!userId || !courseId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId or courseId",
      });
    }

    // Fetch user
    const user = await model.User.findOne({
      where: { id: userId, isDeleted: false },
    });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!user.email) return res.status(400).json({ success: false, message: "User has no email" });

    // Fetch course
    const course = await model.Course.findByPk(courseId);
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });

    // Check if an offer letter already exists for this user + course
    let offerLetter = await model.OfferLetter.findOne({
      where: { userId, position: course.name || "Intern" }, // using course name as position
    });

    // If not, generate PDF and create new record
    if (!offerLetter) {
      const generatedLetter = await generateOfferLetter(userId, courseId);

      offerLetter = await model.OfferLetter.create({
        userId,
        courseId,
        position: course.name || "Intern",
        startDate: new Date(),
        location: "Work from Home",
        fileUrl: generatedLetter.fileUrl,
        issent: false,
      });
    }

    // Build email content
    const subject = `Your Internship Offer Letter - ${course.name} - Fundsroom InfoTech Pvt Ltd`;
    const html = `
      <p>Dear ${user.fullName || user.firstName},</p>
      <p>Greetings from <b>Eduroom!</b></p>

      <p>
        We are pleased to inform you that you have been selected for the
        <b>Live Project Internship</b> in <b>${course.name}</b>.
      </p>

      <h3>Live Project Details:</h3>
      <p><b>Mode:</b> Online (Virtual)</p>
      <p><b>Duration:</b> ${course.duration || "[Not Set]"} Days</p>
      <p><b>Start Date:</b> Find in the Offer Letter</p>

      <p>
        Please find your official <b>Offer Letter</b> here:
        <p><a href="${offerLetter.fileUrl}" target="_blank">${offerLetter.fileUrl}</a></p>
      </p>

      <p>For any queries, reach us at <a href="mailto:recruitment@eduroom.in">recruitment@eduroom.in</a></p>

      <br/>
      <p>Best Regards,<br/>Eduroom HR Team</p>
    `;

    // Send Email
    const mailResult = await sendMail(user.email, subject, html);

    if (!mailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send email",
        error: mailResult.error,
      });
    }

    // Update OfferLetter entry to mark as sent
    if (!offerLetter.issent) {
      await offerLetter.update({ issent: true, updatedAt: new Date() });
    }

    return res.status(200).json({
      success: true,
      message: "Offer Letter sent successfully",
      fileUrl: offerLetter.fileUrl,
    });
  } catch (error) {
    console.error("sendOfferLetter error:", error);
    return res.status(500).json({ success: false, message: "Server error", error });
  }
};

module.exports = { sendOfferLetter };


const sendInternshipReport = async (req, res) => {
  try {
    const { userId, courseId } = req.params; // get both userId and courseId
    if (!userId || !courseId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId or courseId",
      });
    }

    // Fetch user
    const user = await model.User.findOne({
      where: { id: userId, isDeleted: false },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.email) {
      return res
        .status(400)
        .json({ success: false, message: "User has no email" });
    }

    // Generate Internship Report
    const options = {
      courseId,
      internName: user.fullName || user.firstName,
      userId, // ✅ Pass the userId here so the report knows whose answers to fetch
    };

    const report = await generateMCQCaseStudyReport(options);

    // Build email content
    const subject = `Your Internship Report - Fundsroom InfoTech Pvt Ltd`;
    const html = `
      <p>Dear ${user.fullName || user.firstName},</p>
      <p>Greetings from <b>Eduroom!</b></p>

      <p>
        We are pleased to share your <b>Internship Completion Report</b>.
        This report highlights your performance, learning outcomes, and the
        value you’ve gained during the internship program with Eduroom.
      </p>

      <p>Please find your report attached.</p>
    `;

    // TODO: send email with report.fileUrl as attachment or link
    // e.g., using AWS SES or any email service

    return res.status(200).json({
      success: true,
      message: "Internship report generated successfully",
      reportUrl: report.fileUrl,
    });
  } catch (error) {
    console.error("Error sending internship report:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while generating the report",
    });
  }
};
module.exports.sendInternshipReport = sendInternshipReport;


const sendCertificate = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Missing userId" });
    }

    // Fetch user
    const user = await model.User.findOne({
      where: { id: userId, isDeleted: false },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.email) {
      return res.status(400).json({ success: false, message: "User has no email" });
    }

    // Generate Certificate PDF
    const certificate = await generateCertificate(userId);

    // Build email content
    const subject = `Your Module 1 Completion Certificate - Eduroom`;
    const html = `
      <p>Dear ${user.fullName || user.firstName},</p>
      <p>Greetings from <b>Eduroom!</b></p>

      <p>
        Congratulations! Please find your <b>Module 1 Completion Certificate</b> attached:
      </p>

      <p><a href="${certificate.fileUrl}" target="_blank">${certificate.fileUrl}</a></p>

      <p>We appreciate your effort and commitment during the onboarding process.</p>

      <br/>
      <p>Best Regards,<br/>Eduroom HR Team</p>
    `;

    // Send Email
    const mailResult = await sendMail(user.email, subject, html);

    if (!mailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send email",
        error: mailResult.error,
      });
    }

    // Optional: Save record to DB if you have a table like CertificateReport
    if (model.CertificateReport) {
      await model.CertificateReport.create({
        userId,
        fileUrl: certificate.fileUrl,
        issent: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Certificate sent successfully",
      fileUrl: certificate.fileUrl,
    });

  } catch (error) {
    console.error("sendCertificate error:", error);
    return res.status(500).json({ success: false, message: "Server error", error });
  }
};

module.exports.sendCertificate = sendCertificate;





// const listAllUsers = async (req, res) => {
//   try {
//     // Fetch users with related models
//     const users = await User.findAll({
//       include: [
//         {
//           model: TeamManager,
//           as: "teamManager",
//           attributes: ["id", "name", "internshipStatus"]
//         },
//         {
//           model: InternshipCertificate,
//           attributes: ["id", "courseId", "certificateUrl", "isIssued", "issuedDate"]
//         },
//         {
//           model: OfferLetter,
//           attributes: ["id", "fileUrl", "issent", "startDate"]
//         }
//       ]
//     });

//     const courses = await Course.findAll({
//       attributes: ["id", "name", "duration", "businessTarget", "domainId"],
//       include: [{ model: Domain, attributes: ["id", "name"] }]
//     });

//     const allTeamManagers = await TeamManager.findAll({
//       where: { isDeleted: false },
//       attributes: ["id", "managerId", "name", "email", "mobileNumber", "department", "position", "internshipStatus"]
//     });

//     const userIds = users.map(u => u.id);
//     const raiseQueries = await RaiseQuery.findAll({
//       where: { userId: userIds, isDeleted: false },
//       attributes: ["userId", "isQueryRaised", "queryStatus"]
//     });

//     // Aggregate query info per user
//     const queryInfoByUser = {};
//     raiseQueries.forEach(q => {
//       if (!queryInfoByUser[q.userId]) {
//         queryInfoByUser[q.userId] = {
//           isQueryRaised: q.isQueryRaised || false,
//           queryStatus: q.queryStatus || null,
//           queryCount: 1
//         };
//       } else {
//         queryInfoByUser[q.userId].queryCount += 1;
//         queryInfoByUser[q.userId].queryStatus = q.queryStatus || queryInfoByUser[q.userId].queryStatus;
//         queryInfoByUser[q.userId].isQueryRaised = queryInfoByUser[q.userId].isQueryRaised || q.isQueryRaised;
//       }
//     });

//     const response = [];

//     for (const user of users) {
//       // Prepare course details
//       const courseDetails = [];
//       if (user.courseStatuses && typeof user.courseStatuses === "object") {
//         for (const [courseId, status] of Object.entries(user.courseStatuses)) {
//           const course = courses.find(c => c.id.toString() === courseId);
//           courseDetails.push({
//             courseId,
//             courseName: course ? course.name : null,
//             duration: course ? course.duration : null,
//             businessTarget: course ? course.businessTarget : null,
//             domainName: course && course.Domain ? course.Domain.name : null,
//             status,
//             startDate:
//               user.courseDates && user.courseDates[courseId]
//                 ? user.courseDates[courseId].startDate
//                 : null,
//             endDate:
//               user.courseDates && user.courseDates[courseId]
//                 ? user.courseDates[courseId].endDate
//                 : null
//           });
//         }
//       }

//       const internshipIssued =
//         user.InternshipCertificates && user.InternshipCertificates.length > 0
//           ? user.InternshipCertificates.some(cert => cert.isIssued)
//           : null;

//       const teamManager = user.teamManager
//         ? {
//             id: user.teamManager.id,
//             name: user.teamManager.name,
//             internshipStatus: user.teamManager.internshipStatus
//           }
//         : null;

//       const offerLetterSent =
//         user.OfferLetters && user.OfferLetters.length > 0
//           ? user.OfferLetters[0].issent
//           : false;

//       const offerLetterFile =
//         user.OfferLetters && user.OfferLetters.length > 0
//           ? user.OfferLetters[0].fileUrl
//           : null;

//       const queryInfo = queryInfoByUser[user.id] || { isQueryRaised: false, queryStatus: null, queryCount: 0 };

//       const newStatusData = {
//         userId: user.id,
//         userName: `${user.firstName} ${user.lastName}`,
//         email: user.email,
//         phoneNumber: user.phoneNumber,
//         collegeName: user.collegeName,
//         subscriptionWallet: user.subscriptionWallet,
//         subscriptionLeft: user.subscriptionLeft,
//         courses: courseDetails,
//         internshipIssued,
//         offerLetterSent,
//         offerLetterFile,
//         queryStatus: queryInfo.queryStatus,
//         isQueryRaised: queryInfo.isQueryRaised,
//         queryCount: queryInfo.queryCount,
//         internshipStatus: teamManager ? teamManager.internshipStatus : null,
//         teamManager: teamManager ? teamManager.name : null
//       };

//       // 🔹 FIXED: Check if Status already exists for this user
//       let statusRecord = await Status.findOne({ where: { userId: user.id } });

//       if (statusRecord) {
//         // Update existing record
//         await statusRecord.update(newStatusData);
//       } else {
//         // Create new record
//         statusRecord = await Status.create(newStatusData);

//         // Save the newly created statusId to user
//         await user.update({ statusId: statusRecord.id });
//       }

//       response.push({
//         statusId: statusRecord.id,
//         ...statusRecord.toJSON()
//       });
//     }

//     return ReS(res, {
//       success: true,
//       data: response,
//       teamManagers: {
//         total: allTeamManagers.length,
//         list: allTeamManagers
//       }
//     }, 200);

//   } catch (err) {
//     console.error("Error in listAllUsers:", err);
//     return ReE(res, err.message, 500);
//   }
// };

// module.exports.listAllUsers = listAllUsers;


// const listAllUsers = async (req, res) => {
//   try {
//     // Fetch users with related models
//     const users = await User.findAll({
//       include: [
//         {
//           model: TeamManager,
//           as: "teamManager",
//           attributes: ["id", "name", "internshipStatus"]
//         },
//         {
//           model: InternshipCertificate,
//           attributes: ["id", "courseId", "certificateUrl", "isIssued", "issuedDate"]
//         },
//         {
//           model: OfferLetter,
//           attributes: ["id", "fileUrl", "issent", "startDate"]
//         }
//       ]
//     });

//     const courses = await Course.findAll({
//       attributes: ["id", "name", "duration", "businessTarget", "domainId"],
//       include: [{ model: Domain, attributes: ["id", "name"] }]
//     });

//     const allTeamManagers = await TeamManager.findAll({
//       where: { isDeleted: false },
//       attributes: ["id", "managerId", "name", "email", "mobileNumber", "department", "position", "internshipStatus"]
//     });

//     const userIds = users.map(u => u.id);
//     const raiseQueries = await RaiseQuery.findAll({
//       where: { userId: userIds, isDeleted: false },
//       attributes: ["userId", "isQueryRaised", "queryStatus"]
//     });

//     // Aggregate query info per user (count number of raised queries)
//     const queryInfoByUser = {};
//     raiseQueries.forEach(q => {
//       if (!queryInfoByUser[q.userId]) {
//         queryInfoByUser[q.userId] = {
//           isQueryRaised: q.isQueryRaised || false,
//           queryStatus: q.queryStatus || null,
//           queryCount: q.isQueryRaised ? 1 : 0
//         };
//       } else {
//         if (q.isQueryRaised) queryInfoByUser[q.userId].queryCount += 1;
//         queryInfoByUser[q.userId].isQueryRaised = queryInfoByUser[q.userId].isQueryRaised || q.isQueryRaised;
//         queryInfoByUser[q.userId].queryStatus = queryInfoByUser[q.userId].queryStatus || q.queryStatus;
//       }
//     });

//     const response = [];

//     for (const user of users) {
//       // Prepare course details
//       const courseDetails = [];
//       if (user.courseStatuses && typeof user.courseStatuses === "object") {
//         for (const [courseId, status] of Object.entries(user.courseStatuses)) {
//           const course = courses.find(c => c.id.toString() === courseId);
//           courseDetails.push({
//             courseId,
//             courseName: course ? course.name : null,
//             duration: course ? course.duration : null,
//             businessTarget: course ? course.businessTarget : null,
//             domainName: course && course.Domain ? course.Domain.name : null,
//             status,
//             startDate:
//               user.courseDates && user.courseDates[courseId]
//                 ? user.courseDates[courseId].startDate
//                 : null,
//             endDate:
//               user.courseDates && user.courseDates[courseId]
//                 ? user.courseDates[courseId].endDate
//                 : null
//           });
//         }
//       }

//       const internshipIssued =
//         user.InternshipCertificates && user.InternshipCertificates.length > 0
//           ? user.InternshipCertificates.some(cert => cert.isIssued)
//           : null;

//       const teamManager = user.teamManager
//         ? {
//           id: user.teamManager.id,
//           name: user.teamManager.name,
//           internshipStatus: user.teamManager.internshipStatus
//         }
//         : null;

//       const offerLetterSent =
//         user.OfferLetters && user.OfferLetters.length > 0
//           ? user.OfferLetters[0].issent
//           : false;

//       const offerLetterFile =
//         user.OfferLetters && user.OfferLetters.length > 0
//           ? user.OfferLetters[0].fileUrl
//           : null;

//       const queryInfo = queryInfoByUser[user.id] || { isQueryRaised: false, queryStatus: null, queryCount: 0 };

//       const createdAtFormatted = user.createdAt
//         ? moment(user.createdAt).format("YYYY-MM-DD HH:mm:ss")
//         : null;

//       // Only fields that should change on update
//       const fieldsToUpdate = {
//         subscriptionWallet: user.subscriptionWallet,
//         subscriptionLeft: user.subscriptionLeft,
//         courses: courseDetails,
//         internshipIssued,
//         offerLetterSent,
//         offerLetterFile,
//         queryStatus: queryInfo.queryStatus,
//         isQueryRaised: queryInfo.isQueryRaised,
//         queryCount: queryInfo.queryCount,
//         registeredAt: createdAtFormatted
//       };

//       // Check if a Status record already exists for this user
//       let statusRecord = await Status.findOne({ where: { userId: user.id } });

//       if (statusRecord) {
//         // Update only the relevant fields
//         await statusRecord.update(fieldsToUpdate);
//       } else {
//         // Create new record including teamManager & internshipStatus
//         statusRecord = await Status.create({
//           userId: user.id,
//           userName: `${user.firstName} ${user.lastName}`,
//           email: user.email,
//           phoneNumber: user.phoneNumber,
//           collegeName: user.collegeName,
//           ...fieldsToUpdate,
//           teamManager: teamManager ? teamManager.name : null,
//           internshipStatus: teamManager ? teamManager.internshipStatus : null
//         });

//         // Save the new statusId to user
//         await user.update({ statusId: statusRecord.id });
//       }

//       response.push({
//         statusId: statusRecord.id,
//         ...statusRecord.toJSON()
//       });
//     }

//     return ReS(res, {
//       success: true,
//       data: response,
//       teamManagers: {
//         total: allTeamManagers.length,
//         list: allTeamManagers
//       }
//     }, 200);

//   } catch (err) {
//     console.error("Error in listAllUsers:", err);
//     return ReE(res, err.message, 500);
//   }
// };

// module.exports.listAllUsers = listAllUsers; 

const listAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      include: [
        {
          model: TeamManager,
          as: "teamManager",
          attributes: ["id", "name", "internshipStatus"]
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

    const courses = await Course.findAll({
      attributes: ["id", "name", "duration", "businessTarget", "domainId"],
      include: [{ model: Domain, attributes: ["id", "name"] }]
    });

    const allTeamManagers = await TeamManager.findAll({
      where: { isDeleted: false },
      attributes: [
        "id",
        "managerId",
        "name",
        "email",
        "mobileNumber",
        "department",
        "position",
        "internshipStatus"
      ]
    });

    const userIds = users.map(u => u.id);
    const raiseQueries = await RaiseQuery.findAll({
      where: { userId: userIds, isDeleted: false },
      attributes: ["userId", "isQueryRaised", "queryStatus"]
    });

    const queryInfoByUser = {};
    raiseQueries.forEach(q => {
      if (!queryInfoByUser[q.userId]) {
        queryInfoByUser[q.userId] = {
          isQueryRaised: q.isQueryRaised || false,
          queryStatus: q.queryStatus || null,
          queryCount: q.isQueryRaised ? 1 : 0
        };
      } else {
        if (q.isQueryRaised) queryInfoByUser[q.userId].queryCount += 1;
        queryInfoByUser[q.userId].isQueryRaised =
          queryInfoByUser[q.userId].isQueryRaised || q.isQueryRaised;
        queryInfoByUser[q.userId].queryStatus =
          queryInfoByUser[q.userId].queryStatus || q.queryStatus;
      }
    });

    const response = [];

    // Counters for overall course completion
    let totalCourses = 0;
    let completedCourses = 0;

    for (const user of users) {
      const courseDetails = [];

      // per-user counters
      let userTotalCourses = 0;
      let userCompletedCourses = 0;

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
            startDate: user.courseDates?.[courseId]?.startDate || null,
            endDate: user.courseDates?.[courseId]?.endDate || null
          });

          // update per-user counters
          userTotalCourses++;
          if (status === "completed") userCompletedCourses++;

          // update global counters
          totalCourses++;
          if (status === "completed") completedCourses++;
        }
      }

      // per-user course completion percent
      const userCourseCompletionPercent =
        userTotalCourses > 0
          ? ((userCompletedCourses / userTotalCourses) * 100).toFixed(2)
          : "0.00";

      const internshipIssued =
        user.InternshipCertificates && user.InternshipCertificates.length > 0
          ? user.InternshipCertificates.some(cert => cert.isIssued)
          : null;

      const teamManager = user.teamManager
        ? {
            id: user.teamManager.id,
            name: user.teamManager.name,
            internshipStatus: user.teamManager.internshipStatus
          }
        : null;

      const offerLetterSent =
        user.OfferLetters && user.OfferLetters.length > 0
          ? user.OfferLetters[0].issent
          : false;

      const offerLetterFile =
        user.OfferLetters && user.OfferLetters.length > 0
          ? user.OfferLetters[0].fileUrl
          : null;

      const queryInfo =
        queryInfoByUser[user.id] || {
          isQueryRaised: false,
          queryStatus: null,
          queryCount: 0
        };

      const createdAtFormatted = user.createdAt
        ? moment(user.createdAt).format("YYYY-MM-DD HH:mm:ss")
        : null;

      const fieldsToUpdate = {
        subscriptionWallet: user.subscriptionWallet,
        subscriptionLeft: user.subscriptionLeft,
        selected: user.selected || null,
        referralCode: user.referralCode || null,
        courses: courseDetails,
        internshipIssued,
        offerLetterSent,
        offerLetterFile,
        queryStatus: queryInfo.queryStatus,
        isQueryRaised: queryInfo.isQueryRaised,
        queryCount: queryInfo.queryCount,
        registeredAt: createdAtFormatted,
        courseCompletionPercent: userCourseCompletionPercent // ✅ per-user percentages
      };

      let statusRecord = await Status.findOne({ where: { userId: user.id } });

      if (statusRecord) {
        await statusRecord.update(fieldsToUpdate);
      } else {
        statusRecord = await Status.create({
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phoneNumber: user.phoneNumber,
          collegeName: user.collegeName,
          ...fieldsToUpdate,
          teamManager: teamManager ? teamManager.name : null,
          internshipStatus: teamManager ? teamManager.internshipStatus : null
        });

        await user.update({ statusId: statusRecord.id });
      }

      response.push({
        statusId: statusRecord.id,
        ...statusRecord.toJSON()
      });
    }

    // Overall course completion percentage
    const courseCompletionPercent =
      totalCourses > 0 ? ((completedCourses / totalCourses) * 100).toFixed(2) : "0.00";

    return ReS(
      res,
      {
        success: true,
        data: response,
        teamManagers: {
          total: allTeamManagers.length,
          list: allTeamManagers
        },
        overallStatus: {
          courseCompletionPercent
        }
      },
      200
    );
  } catch (err) {
    console.error("Error in listAllUsers:", err);
    return ReE(res, err.message, 500);
  }
};

module.exports.listAllUsers = listAllUsers;
