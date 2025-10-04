"use strict";
const { generateOfferLetter } = require("../utils/offerletter.service.js");
const { generateInternshipDetailsReport } = require("../utils/internshipreport2.service.js");
const {generateSessionReport} = require("../utils/internshipreport3.service.js");
const { sendMail } = require("../middleware/mailer.middleware.js");
const model = require("../models/index.js");
const { User, TeamManager, InternshipCertificate, OfferLetter, Course, Domain, RaiseQuery, Status } = require("../models/index.js");
const { ReE, ReS } = require("../utils/util.service.js");
const moment = require("moment");


// Controller: Send Offer Letter to User Email
const sendOfferLetter = async (req, res) => {
  try {
    const { userId, courseId } = req.params; // take both from params
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

    // Fetch course
    const course = await model.Course.findByPk(courseId);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Generate Offer Letter (PDF uploaded to S3 + DB saved)
    const offerLetter = await generateOfferLetter(userId, courseId); 
    // 🔹 update generateOfferLetter to also accept courseId if needed

    // Build email content (inject course name + duration if available)
    const subject = `Your Internship Offer Letter - ${course.name} - Fundsroom InfoTech Pvt Ltd`;
    const html = `
      <p>Dear ${user.fullName || user.firstName},</p>
      <p>Greetings from <b>Eduroom!</b></p>

      <p>
        We are pleased to inform you that you have been selected for the
        <b>Live Project Internship</b> in <b>${course.name}</b> with Eduroom – India’s leading online internship platform.
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
      <p><b>Duration:</b> ${course.duration || "[Not Set]"} Days</p>
      <p><b>Start Date:</b> Find in the Offer Letter</p>

      <p>
        We welcome you onboard and look forward to your enthusiastic participation.
        This is a valuable opportunity to build your portfolio, enhance your skills,
        and gain career-oriented exposure.
      </p>

      <p>
        Please find your official <b>Offer Letter</b> here:
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
      return res
        .status(500)
        .json({ success: false, message: "Failed to send email", error: mailResult.error });
    }

    // Update DB
    await model.OfferLetter.update(
      {
        issent: true,
        updatedAt: new Date(),
      },
      { where: { id: offerLetter.id } }
    );

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
    const { userId } = req.params; // only userId from params
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId",
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

    // Generate Internship Report (PDF uploaded to S3 + DB saved)
    const report = await generateInternshipDetailsReport(userId);
    // 🔹 You’ll need to implement generateInternshipReport similar to generateOfferLetter

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

      <p>
        Please find your official <b>Internship Report</b> here:
        <p><a href="${report.fileUrl}" target="_blank">${report.fileUrl}</a></p>
      </p>

      <p>
        We hope this experience has helped you enhance your skills and
        contribute meaningfully to your career path.
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
      return res.status(500).json({
        success: false,
        message: "Failed to send email",
        error: mailResult.error,
      });
    }

    // Update DB
    await model.InternshipReport.update(
      {
        issent: true,
        updatedAt: new Date(),
      },
      { where: { id: report.id } }
    );

    return res.status(200).json({
      success: true,
      message: "Internship Report sent successfully",
      fileUrl: report.fileUrl,
    });
  } catch (error) {
    console.error("sendInternshipReport error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error });
  }
};

module.exports. sendInternshipReport = sendInternshipReport;



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
        courses: courseDetails,
        internshipIssued,
        offerLetterSent,
        offerLetterFile,
        queryStatus: queryInfo.queryStatus,
        isQueryRaised: queryInfo.isQueryRaised,
        queryCount: queryInfo.queryCount,
        registeredAt: createdAtFormatted,
        courseCompletionPercent: userCourseCompletionPercent // ✅ per-user percentage
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

const generateSingleSessionReport = async (req, res) => {
  try {
    let { userId, courseId, sessionNumber } = req.params;

    if (!userId) return ReE(res, "userId is required", 400);
    if (!courseId) return ReE(res, "courseId is required", 400);
    if (!sessionNumber) return ReE(res, "sessionNumber is required", 400);

    // Convert params to integers
    userId = parseInt(userId, 10);
    courseId = parseInt(courseId, 10);
    sessionNumber = parseInt(sessionNumber, 10);

    // 1️⃣ Load user
    const user = await model.User.findOne({ where: { id: userId, isDeleted: false } });
    if (!user) return ReE(res, "User not found", 404);

    // 2️⃣ Load course with domain
    const course = await model.Course.findOne({
      where: { id: courseId, isDeleted: false },
      include: [{ model: model.Domain, attributes: ["name"], required: false }]
    });
    if (!course) return ReE(res, "Course not found", 404);

    // 3️⃣ Load session details
    const session = await model.CourseDetail.findOne({
      where: { courseId, sessionNumber, isDeleted: false }
    });
    if (!session) return ReE(res, "Session not found", 404);

    // 4️⃣ Prepare MCQs
    let mcqs = [];
    try {
      const progressMap = session.userProgress || {};
      const progress = progressMap[String(userId)] || progressMap[userId] || {};
      mcqs = (progress.questions ?? []).map(q => ({
        question: q.question || q.q || "",
        options: q.options || q.choices || q.opts || [],
        correctAnswer: q.correctAnswer || q.correct || q.answer || ""
      }));
    } catch (err) {
      mcqs = [];
    }

    // 5️⃣ Fetch latest case study result
    const latestCaseStudy = await model.CaseStudyResult.findOne({
      where: { userId, courseId, day: session.day, sessionNumber },
      order: [["createdAt", "DESC"]]
    });

    const { startDate = null, endDate = null } = user.courseDates?.[courseId] || {};

    // 6️⃣ Prepare session data for PDF
    const sessionData = {
      userId: user.id,
      userName: user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      domainName: course.Domain?.name || "",
      courseId: course.id,
      courseName: course.name,
      day: session.day,
      sessionNumber,
      sessionTitle: session.title || "",
      sessionDuration: session.sessionDuration || "",
      startDate,
      endDate,
      mcqs,
      caseStudyResult: latestCaseStudy
        ? { 
            matchPercentage: latestCaseStudy.matchPercentage, 
            summary: latestCaseStudy.summary || latestCaseStudy.notes || "" 
          }
        : null
    };

    // 7️⃣ Generate PDF and upload to S3
    const generated = await generateSessionReport(sessionData, { bgUrl: `${ASSET_BASE}/internshipbg.png` });

    return ReS(res, { success: true, data: generated }, 200);

  } catch (error) {
    console.error("generateSingleSessionReport error:", error);
    return ReE(res, error.message || "Internal Server Error", 500);
  }
};

module.exports.generateSingleSessionReport = generateSingleSessionReport;
