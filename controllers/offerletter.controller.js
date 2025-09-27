"use strict";
const { generateOfferLetter } = require("../utils/offerletter.service.js");
const { sendMail } = require("../middleware/mailer.middleware.js");
const model = require("../models/index.js");
const { User, TeamManager, InternshipCertificate, OfferLetter, Course, Domain ,RaiseQuery,Status } = require("../models/index.js");
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
    const subject = "Your Internship Offer Letter - Fundsroom InfoTech Pvt Ltd";
    const html = `
  <p>Dear ${user.fullName || user.firstName},</p>

  <p>Greetings from <b>Eduroom!</b></p>

  <p>
    We are pleased to inform you that you have been selected for the 
    <b>Live Project Internship</b> with Eduroom – India’s leading online internship platform.
  </p>

  <p>
    This internship is designed to provide you with practical industry exposure through:
  </p>
  <ul>
    <li><b>Structured Learning:</b> Video sessions, case studies, and quizzes.</li>
    <li><b>Hands-on Tasks:</b> Real-time projects and assignments aligned with industry practices.</li>
  </ul>

  <h3>Live Project Details:</h3>
  <p><b>Mode:</b> Online (Virtual)</p>
  <p><b>Duration:</b> [10 Days / 30 Days / 45 Days]</p>
  <p><b>Start Date:</b>Find In the Offer Letter</p>

  <p>
    We welcome you onboard and look forward to your enthusiastic participation. 
    This is a valuable opportunity to build your portfolio, enhance your skills, 
    and gain career-oriented exposure.
  </p>

  <p>
    Please find your official <b>Offer Letter</b> Here:
    <p><a href="${offerLetter.fileUrl}" target="_blank">${offerLetter.fileUrl}</a></p>
  </p>

  <p>
    For any queries, feel free to reach us at 
    <a href="mailto:recruitment@eduroom.in">recruitment@eduroom.in</a>
  </p>

  <br/>
  <p>Best Regards,<br/>Eduroom HR Team</p>
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


const listAllUsers = async (req, res) => {
  try {
    // Fetch users with related models
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
      attributes: ["id", "managerId", "name", "email", "mobileNumber", "department", "position", "internshipStatus"]
    });

    const userIds = users.map(u => u.id);
    const raiseQueries = await RaiseQuery.findAll({
      where: { userId: userIds, isDeleted: false },
      attributes: ["userId", "isQueryRaised", "queryStatus"]
    });

    // Aggregate query info per user (count number of raised queries)
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
        queryInfoByUser[q.userId].isQueryRaised = queryInfoByUser[q.userId].isQueryRaised || q.isQueryRaised;
        queryInfoByUser[q.userId].queryStatus = queryInfoByUser[q.userId].queryStatus || q.queryStatus;
      }
    });

    const response = [];

    for (const user of users) {
      // Prepare course details
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

      const queryInfo = queryInfoByUser[user.id] || { isQueryRaised: false, queryStatus: null, queryCount: 0 };

      // Only fields that should change on update
      const fieldsToUpdate = {
        subscriptionWallet: user.subscriptionWallet,
        subscriptionLeft: user.subscriptionLeft,
        courses: courseDetails,
        internshipIssued,
        offerLetterSent,
        offerLetterFile,
        queryStatus: queryInfo.queryStatus,
        isQueryRaised: queryInfo.isQueryRaised,
        queryCount: queryInfo.queryCount
      };

      // Check if a Status record already exists for this user
      let statusRecord = await Status.findOne({ where: { userId: user.id } });

      if (statusRecord) {
        // Update only the relevant fields
        await statusRecord.update(fieldsToUpdate);
      } else {
        // Create new record including teamManager & internshipStatus
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

        // Save the new statusId to user
        await user.update({ statusId: statusRecord.id });
      }

      response.push({
        statusId: statusRecord.id,
        ...statusRecord.toJSON()
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
