"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, fn, col } = require("sequelize");
const { sendhrMail } = require("../middleware/mailerhr.middleware.js");


// Allowed values
const allowedInternshipTypes = ["fulltime", "parttime", "sip", "liveproject", "wip", "others"];
const allowedCourses = ["mba", "pgdm", "mba+pgdm", "bba/bcom", "engineering", "other"];

const createResume = async (req, res) => {
  try {
    const dataArray = Array.isArray(req.body) ? req.body : [req.body];

    // ✅ Resolve teamManagerId (if missing, accept null)
    const teamManagerId = req.body.teamManagerId ?? req.user?.id ?? null;

    // ✅ Find coSheetId (null if not found or no teamManagerId)
    let coSheetId = null;
    if (teamManagerId) {
      try {
        const coSheet = await model.CoSheet.findOne({ where: { teamManagerId } });
        if (coSheet) coSheetId = coSheet.id;
      } catch (err) {
        console.warn("CoSheet lookup failed:", err.message);
      }
    }

    // ✅ Prepare payloads (accept whatever comes in)
    const payloads = dataArray.map(data => ({
      sr: data.sr ?? null,
      resumeDate: data.resumeDate ?? null,
      collegeName: data.collegeName ?? null,
      course: data.course ?? null,
      internshipType: data.internshipType ?? null,
      followupBy: data.followupBy ?? null,
      studentName: data.studentName ?? null,
      mobileNumber: data.mobileNumber ?? null,
      emailId: data.emailId ?? null,
      domain: data.domain ?? null,
      interviewDate: data.interviewDate ?? null,
      dateOfOnboarding: data.dateOfOnboarding ?? null,
      coSheetId: coSheetId,
      teamManagerId: teamManagerId,
    }));

    // ✅ Bulk insert (NO duplicate check, accept everything)
    let records = [];
    try {
      records = await model.StudentResume.bulkCreate(payloads, {
        returning: true,
      });
    } catch (err) {
      console.error("Bulk insert failed:", err.message);
    }

    // ✅ Always respond 200, never throw 400/500
    return res.status(200).json({
      success: true,
      inserted: records.length,
      totalSent: payloads.length,
    });

  } catch (error) {
    console.error("StudentResume Create Error:", error);

    // ✅ Still return 200 OK
    return res.status(200).json({
      success: false,
      inserted: 0,
      totalSent: Array.isArray(req.body) ? req.body.length : 1,
      warning: error.message,
    });
  }
};

module.exports.createResume = createResume;


// ✅ Update Resume Record
const updateResume = async (req, res) => {
  try {
    const record = await model.StudentResume.findByPk(req.params.id);
    if (!record) return ReE(res, "Resume record not found", 404);

    const updates = {};
    const allowedFields = [
      "sr", "resumeDate", "collegeName", "course", "internshipType",
      "followupBy", "studentName", "mobileNumber", "emailId",
      "domain", "interviewDate", "teamManagerId", "dateOfOnboarding"
    ];

    for (let f of allowedFields) {
      if (req.body[f] !== undefined) {
        if (f === "internshipType") {
          const val = req.body[f]?.toLowerCase();
          if (val && !allowedInternshipTypes.includes(val)) {
            return ReE(res, `Invalid internshipType. Allowed: ${allowedInternshipTypes.join(", ")}`, 400);
          }
          updates[f] = val;
        } else if (f === "course") {
          const val = req.body[f]?.toLowerCase();
          if (val && !allowedCourses.includes(val)) {
            return ReE(res, `Invalid course. Allowed: ${allowedCourses.join(", ")}`, 400);
          }
          updates[f] = val;
        } else {
          updates[f] = req.body[f];
        }
      }
    }

    // ✅ Always ensure coSheetId matches teamManagerId (from updates or existing record)
    const effectiveTeamManagerId = updates.teamManagerId ?? record.teamManagerId;
    if (effectiveTeamManagerId) {
      const coSheet = await model.CoSheet.findOne({ where: { teamManagerId: effectiveTeamManagerId } });
      updates.coSheetId = coSheet ? coSheet.id : null;
    }

    if (!Object.keys(updates).length) {
      return ReE(res, "No fields to update", 400);
    }

    await record.update(updates);
    return ReS(res, { success: true, data: record }, 200);

  } catch (error) {
    console.error("StudentResume Update Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.updateResume = updateResume;


// ✅ List all resumes
const listResumes = async (req, res) => {
  try {
    console.log("🚀 Starting StudentResume list sync...");

    // ---------------------------
    // 1️⃣ Sync Student Registrations
    // ---------------------------
    const resumesToSync = await model.StudentResume.findAll({
      where: { isRegistered: false },
      attributes: ["id", "mobileNumber", "isRegistered", "dateOfRegistration"],
    });

    console.log(`🟡 Found ${resumesToSync.length} resumes to sync registration status.`);

    for (const resume of resumesToSync) {
      if (!resume.mobileNumber) continue;

      const user = await model.User.findOne({
        where: { phoneNumber: resume.mobileNumber },
        attributes: ["id", "createdAt"],
        raw: true,
      });

      if (user) {
        await resume.update({
          isRegistered: true,
          dateOfRegistration: user.createdAt,
        });
        console.log(`🔄 Updated registration for StudentResume ID ${resume.id}`);
      }
    }

    // ---------------------------
    // 2️⃣ Fetch all resumes with associations
    // ---------------------------
    console.log("🔍 Fetching all resumes with associations...");
    const records = await model.StudentResume.findAll({
      include: [
        { model: model.CoSheet, attributes: ["id", "collegeName"] },
        {
          model: model.User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "phoneNumber", "email", "createdAt"],
          include: [
            {
              model: model.FundsAudit,
              attributes: [
                "id",
                "registeredUserId",
                "firstName",
                "lastName",
                "phoneNumber",
                "email",
                "dateOfPayment",
                "dateOfDownload",
                "hasPaid",
                "isDownloaded",
                "queryStatus",
                "isQueryRaised",
                "occupation",
              ],
              where: { hasPaid: true },
              required: false,
              separate: true,
            },
            { model: model.TeamManager, as: "teamManager", attributes: ["id", "name", "email"] },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    console.log(`📄 Total resumes fetched: ${records.length}`);

    // ---------------------------
    // 3️⃣ Store FundsAudit data per studentResume and user without duplicates
    // ---------------------------
    for (const resume of records) {
      const user = resume.user;
      if (!user || !user.FundsAudits) continue;

      for (const fa of user.FundsAudits) {
        // Check if record already exists
        const exists = await model.FundsAuditStudent.findOne({
          where: {
            studentResumeId: resume.id,
            userId: user.id,
            fundsAuditId: fa.id,
          },
        });

        if (exists) {
          console.log(`⚠️ Skipping duplicate FundsAuditStudent for StudentResume ID ${resume.id}, FundsAudit ID ${fa.id}`);
          continue;
        }

        const teamManagerName = user.teamManager ? user.teamManager.name : resume.teamManagerId;

        await model.FundsAuditStudent.create({
          studentResumeId: resume.id,
          userId: user.id,
          fundsAuditId: fa.id,
          registeredUserId: fa.registeredUserId,
          firstName: fa.firstName,
          lastName: fa.lastName,
          phoneNumber: fa.phoneNumber,
          email: fa.email,
          dateOfPayment: fa.dateOfPayment,
          dateOfDownload: fa.dateOfDownload,
          hasPaid: fa.hasPaid,
          isDownloaded: fa.isDownloaded,
          queryStatus: fa.queryStatus,
          isQueryRaised: fa.isQueryRaised,
          occupation: fa.occupation,
          teamManager: teamManagerName,
        });

        console.log(`✅ Inserted FundsAuditStudent for StudentResume ID ${resume.id}, FundsAudit ID ${fa.id}`);
      }
    }

    // ---------------------------
    // 4️⃣ Return response
    // ---------------------------
    console.log("🏁 All processing done successfully!");
    return ReS(res, { success: true, data: records }, 200);
  } catch (error) {
    console.error("StudentResume List Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.listResumes = listResumes;



// ✅ Delete resume by ID
const deleteResume = async (req, res) => {
  try {
    const record = await model.StudentResume.findByPk(req.params.id);
    if (!record) return ReE(res, "Resume not found", 404);

    await record.destroy();

    return ReS(res, { success: true, message: "Resume deleted successfully" }, 200);
  } catch (error) {
    console.error("StudentResume Delete Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.deleteResume = deleteResume;


const getCollegeAnalysis = async (req, res) => {
  try {
    const teamManagerId = req.user?.id || req.query.teamManagerId;
    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

    // Join StudentResume with CoSheet (only to fetch resumeDate)
    const resumes = await model.StudentResume.findAll({
      where: { teamManagerId: teamManagerId },
      attributes: ["id", "studentName", "collegeName", "interviewDate", "resumeDate"],
      order: [["collegeName", "ASC"]],
    });

    if (!resumes.length) return ReS(res, [], 200);

    // Group by StudentResume.collegeName
    const grouped = {};
    resumes.forEach((r) => {
      const college = r.collegeName || "Unknown College";

      if (!grouped[college]) {
        grouped[college] = {
          collegeName: college,
          numberOfStudentResumes: 0,
          resumeDates: [],
          interviewDates: [],
        };
      }

      grouped[college].numberOfStudentResumes += 1;

      // ✅ resumeDate from CoSheet
      if (r.resumeDate) {
        const formatted = new Date(r.resumeDate).toLocaleDateString("en-GB");
        if (!grouped[college].resumeDates.includes(formatted)) {
          grouped[college].resumeDates.push(formatted);
        }
      }

      // ✅ interviewDate from StudentResume
      if (r.interviewDate) {
        const formatted = new Date(r.interviewDate).toLocaleDateString("en-GB");
        grouped[college].interviewDates.push(formatted);
      }
    });

    // Format response
    const result = Object.values(grouped).map((g, index) => ({
      sr: index + 1,
      collegeName: g.collegeName,
      numberOfStudentResumes: g.numberOfStudentResumes,
      dateOfResumesReceived: g.resumeDates.map((d, i) => `${i + 1}. ${d}`),
      dateOfInterviewsScheduled: g.interviewDates.map((d, i) => `${i + 1}. ${d}`),
    }));

    return ReS(res, result, 200);
  } catch (error) {
    console.error("College Analysis Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCollegeAnalysis = getCollegeAnalysis;

// ✅ DAILY CALENDAR ANALYSIS
const getDailyCalendarAnalysis = async (req, res) => {
  try {
    const { fromDate, toDate, teamManagerId } = req.query;

    if (!teamManagerId) {
      return res.status(400).json({ success: false, error: "teamManagerId is required" });
    }

    // Default date range → current month
    let startDate = fromDate
      ? new Date(fromDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    let endDate = toDate
      ? new Date(toDate)
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    // ✅ Fetch resumes (from StudentResume)
    const resumes = await model.StudentResume.findAll({
      where: {
        teamManagerId,
        resumeDate: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        [literal(`DATE("resumeDate")`), "date"],
        "collegeName",
        [fn("COUNT", col("id")), "resumeCount"],
      ],
      group: ["date", "collegeName"],
      raw: true,
    });

    // ✅ Fetch interviews
    const interviews = await model.StudentResume.findAll({
      where: {
        teamManagerId,
        interviewDate: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        [literal(`DATE("interviewDate")`), "date"],
        "collegeName",
        [fn("COUNT", col("id")), "interviewCount"],
      ],
      group: ["date", "collegeName"],
      raw: true,
    });

    // ✅ Merge data into calendar format
    const map = {};

    resumes.forEach((r) => {
      const date = r.date;
      if (!map[date]) {
        map[date] = {
          date,
          day: new Date(date + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "long",
          }),
          resumesReceived: 0,
          resumesColleges: [],
          interviewsScheduled: 0,
          interviewsColleges: [],
        };
      }
      map[date].resumesReceived += parseInt(r.resumeCount);
      map[date].resumesColleges.push(
        `${map[date].resumesColleges.length + 1}. ${r.collegeName} (${r.resumeCount})`
      );
    });

    interviews.forEach((i) => {
      const date = i.date;
      if (!map[date]) {
        map[date] = {
          date,
          day: new Date(date + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "long",
          }),
          resumesReceived: 0,
          resumesColleges: [],
          interviewsScheduled: 0,
          interviewsColleges: [],
        };
      }
      map[date].interviewsScheduled += parseInt(i.interviewCount);
      map[date].interviewsColleges.push(
        `${map[date].interviewsColleges.length + 1}. ${i.collegeName} (${i.interviewCount})`
      );
    });

    const result = Object.values(map).sort((a, b) => new Date(a.date) - new Date(b.date));
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error("Error in Daily Calendar Analysis:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports.getDailyCalendarAnalysis = getDailyCalendarAnalysis;

// ✅ USER WORK ANALYSIS
const getUserWorkAnalysis = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    let whereClause = {};
    if (fromDate && toDate) {
      whereClause.resumeDate = {
        [Op.between]: [new Date(fromDate), new Date(toDate)],
      };
    }

    const resumes = await model.StudentResume.findAll({
      where: whereClause,
      include: [{ model: model.CoSheet, attributes: ["collegeName"] }],
    });

    const analysis = {};
    resumes.forEach((resume) => {
      const followupBy = resume.followupBy || "Unknown";
      if (!analysis[followupBy]) {
        analysis[followupBy] = {
          followupBy,
          colleges: new Map(),
          totalResumes: 0,
          onboardingDates: [],
        };
      }

      const collegeName =
        resume.CoSheet?.collegeName || resume.collegeName || "Unknown College";
      const resumeDate = resume.resumeDate
        ? resume.resumeDate.toISOString().split("T")[0]
        : null;

      const resumeCount = 1;

      if (!analysis[followupBy].colleges.has(collegeName)) {
        analysis[followupBy].colleges.set(collegeName, 0);
      }

      analysis[followupBy].colleges.set(
        collegeName,
        analysis[followupBy].colleges.get(collegeName) + resumeCount
      );

      analysis[followupBy].totalResumes += resumeCount;

      if (resumeDate) {
        analysis[followupBy].onboardingDates.push(`${resumeDate} (${resumeCount})`);
      }
    });

    const result = Object.values(analysis).map((item, index) => ({
      sr: index + 1,
      followupBy: item.followupBy,
      countOfColleges: item.colleges.size,
      totalResumes: item.totalResumes,
      collegeName: Array.from(item.colleges.entries()).map(
        ([name, count], idx) => `${idx + 1}. ${name} (${count})`
      ),
      dateOfOnboarding: [...new Set(item.onboardingDates)],
    }));

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error in getUserWorkAnalysis:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports.getUserWorkAnalysis = getUserWorkAnalysis;

// ✅ RESUME ANALYSIS
const getRAnalysis = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    let whereClause = {};
    if (fromDate && toDate) {
      whereClause.resumeDate = {
        [Op.between]: [new Date(fromDate), new Date(toDate)],
      };
    }

    const resumes = await model.StudentResume.findAll({
      where: whereClause,
      include: [{ model: model.CoSheet, attributes: ["collegeName"] }],
    });

    const totalResumes = resumes.length;
    const totalInterviews = resumes.filter((r) => r.interviewDate).length;
    const collegeSet = new Set(
      resumes.map((r) => r.CoSheet?.collegeName || r.collegeName || "Unknown College")
    );

    const totalColleges = collegeSet.size;
    const avgResponsePerCollege =
      totalColleges > 0 ? parseFloat((totalResumes / totalColleges).toFixed(1)) : 0;

    const userStats = {};
    resumes.forEach((r) => {
      const user = r.followupBy || "Individual";
      userStats[user] = (userStats[user] || 0) + 1;
    });

    const sortedUsers = Object.entries(userStats).sort((a, b) => b[1] - a[1]);
    const topPerformers = sortedUsers.slice(0, 3).map(
      ([name, count], idx) => `${idx + 1}. ${name} (${count})`
    );
    const lowPerformers = sortedUsers
      .slice(-3)
      .filter(([name]) => !topPerformers.some((s) => s.includes(name)))
      .map(([name, count], idx) => `${idx + 1}. ${name} (${count})`);

    return res.json({
      success: true,
      data: {
        totalResumesReceived: totalResumes,
        totalInterviewsScheduled: totalInterviews,
        totalCollegesResponses: totalColleges,
        averageResponsePerCollege: avgResponsePerCollege,
        topPerformers,
        lowPerformers,
      },
    });
  } catch (error) {
    console.error("Error in getRAnalysis:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports.getRAnalysis = getRAnalysis;

const listResumesByUserId = async (req, res) => {
  try {
    const teamManagerId = req.query.teamManagerId || req.params.teamManagerId;
    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

    // ---------------------------
    // Fetch manager info
    // ---------------------------
    const manager = await model.TeamManager.findOne({
      where: { id: teamManagerId },
      attributes: ["id", "name", "email"],
      raw: true,
    });
    if (!manager) return ReE(res, "Manager not found", 404);

    // ---------------------------
    // Fetch resumes assigned to this manager
    // ---------------------------
    const resumes = await model.StudentResume.findAll({
      where: { teamManagerId },
      include: [
        {
          model: model.FundsAuditStudent, // Include associated FundsAuditStudent entries
          attributes: [
            "id",
            "fundsAuditId",
            "registeredUserId",
            "firstName",
            "lastName",
            "phoneNumber",
            "email",
            "dateOfPayment",
            "dateOfDownload",
            "hasPaid",
            "isDownloaded",
            "queryStatus",
            "isQueryRaised",
            "occupation",
            "teamManager",
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    // ---------------------------
    // Fetch all managers for dropdown/reference
    // ---------------------------
    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email"],
      raw: true,
    });
    const managerList = managers.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
    }));

    // ---------------------------
    // Return response
    // ---------------------------
    return ReS(res, {
      success: true,
      teamManagerId,
      totalRecords: resumes.length,
      data: resumes,
      managers: managerList,
    });
  } catch (error) {
    console.error("ListResumesByUserId Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.listResumesByUserId = listResumesByUserId;


const getUserTargetAnalysis = async (req, res) => {
  try {
    const { fromDate, toDate, teamManagerId } = req.query;
    if (!teamManagerId)
      return res.status(400).json({ success: false, error: "teamManagerId is required" });

    // Fetch team manager info
    const user = await model.TeamManager.findOne({
      where: { id: teamManagerId },
      attributes: ["name"],
      raw: true,
    });

    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });

    const userName = user.name.trim();

    let startDate = fromDate ? new Date(fromDate) : new Date();
    startDate.setHours(0, 0, 0, 0);
    let endDate = toDate ? new Date(toDate) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // Fetch resumes only for this team manager and robust followupBy match
    const resumes = await model.StudentResume.findAll({
      where: {
        teamManagerId,
        resumeDate: { [Op.between]: [startDate, endDate] },
        // robust match: ignore leading/trailing spaces and case
        followupBy: { [Op.iLike]: userName },
      },
      attributes: ["resumeDate", "collegeName", "isRegistered"],
      raw: true,
    });

    // Fetch target data
    const targets = await model.MyTarget.findAll({
      where: {
        teamManagerId,
        targetDate: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        [fn("SUM", col("collegeTarget")), "collegeTarget"],
        [fn("SUM", col("interviewsTarget")), "interviewsTarget"],
        [fn("SUM", col("resumesReceivedTarget")), "resumesReceivedTarget"],
      ],
      raw: true,
    });

    const targetData = targets[0] || {
      collegeTarget: 0,
      interviewsTarget: 0,
      resumesReceivedTarget: 0,
    };

    // Aggregate resumes
    const achieved = {
      followupBy: userName,
      collegesAchieved: new Set(),
      resumesAchieved: 0,
      interviewsAchieved: 0,
      resumeDates: [],
      interviewDates: [],
    };

    resumes.forEach((resume) => {
      if (resume.collegeName) achieved.collegesAchieved.add(resume.collegeName);

      // Count all resumes
      achieved.resumesAchieved += 1;

      // Add resumeDates for all
      if (resume.resumeDate) {
        const formattedDate = new Date(resume.resumeDate).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
        achieved.resumeDates.push(formattedDate);
      }

      // Only registered resumes count as interviewsAchieved
      if (resume.isRegistered) {
        achieved.interviewsAchieved += 1;
        achieved.interviewDates.push(
          new Date(resume.resumeDate).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        );
      }
    });

    const result = [
      {
        followupBy: achieved.followupBy,
        collegeTarget: Number(targetData.collegeTarget),
        collegesAchieved: achieved.collegesAchieved.size,
        interviewsTarget: Number(targetData.interviewsTarget),
        interviewsAchieved: achieved.interviewsAchieved,
        resumesReceivedTarget: Number(targetData.resumesReceivedTarget),
        resumesAchieved: achieved.resumesAchieved,
        resumeDates: achieved.resumeDates,
        interviewDates: achieved.interviewDates,
      },
    ];

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in getUserTargetAnalysis:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports.getUserTargetAnalysis = getUserTargetAnalysis;



// ✅ SEND MAIL TO STUDENT
const sendMailToStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, customMessage, time, link } = req.body;

    const student = await model.StudentResume.findByPk(id);
    if (!student) return ReE(res, "Student record not found", 404);
    if (!student.emailId) return ReE(res, "No email found for this student", 400);

    const interviewDate = student.interviewDate
      ? new Date(student.interviewDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "TBD";

    const subject = "Pre-Placement Talk & Telephonic Interview – FundsAudit";

    const hardcodedHtml = `
      <p>Dear ${student.studentName || "Student"},</p>
      <p>As discussed on telephonic conversation,</p>
      <p>This is to inform you that the <b>Pre-Placement Talk</b> is scheduled on <b>${interviewDate}</b> at <b>${time}</b>.</p>
      <p>After the Pre-Placement Talk, Telephonic Interviews will be conducted for shortlisted students.</p>
      <p>📅 <b>Meeting Date:</b> ${interviewDate}<br/>
      🕚 <b>Timing:</b> ${time}<br/>
      🔗 <b>Link:</b> <a href="${link}">${link}</a></p>
      <p>Please ensure your attendance at the Pre-Placement Talk. Only students attending the talk will be eligible for the Telephonic Interview round.</p>
      <p>Regards,<br/>HR Department,<br/>FundsAudit<br/>+91 7385234536<br/>+91 7420861507<br/>Pune, Maharashtra<br/><a href="https://www.fundsaudit.in/">https://www.fundsaudit.in/</a></p>
    `;

    const html = type === "custom" ? customMessage : hardcodedHtml;

    const mailResponse = await sendhrMail(student.emailId, subject, html);
    if (!mailResponse.success) return ReE(res, "Failed to send email to student", 500);

    await student.update({
      mailSentAt: new Date(),
      interviewTime: time || student.interviewTime,
    });

    return ReS(res, { success: true, message: "Email sent successfully to student" }, 200);
  } catch (error) {
    console.error("Send Student Mail Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.sendMailToStudent = sendMailToStudent;

// ✅ USER RESUMES ACHIEVED
const getUserResumesAchieved = async (req, res) => {
  try {
    const { fromDate, toDate, teamManagerId } = req.query;
    if (!teamManagerId)
      return res.status(400).json({ success: false, error: "teamManagerId is required" });

    // Fetch manager info
    const manager = await model.TeamManager.findOne({
      where: { id: teamManagerId },
      attributes: ["name"],
      raw: true,
    });
    if (!manager) return res.status(404).json({ success: false, error: "Manager not found" });

    const fullName = manager.name.trim();

    // Date filter
    let dateFilter = {};
    if (fromDate && toDate) {
      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);
      dateFilter = { resumeDate: { [Op.between]: [startDate, endDate] } };
    }

    // Fetch resumes with FundsAuditStudents
    const resumes = await model.StudentResume.findAll({
      where: {
        teamManagerId,
        [Op.or]: [
          { followupBy: { [Op.iLike]: fullName } },
          { followupBy: { [Op.iLike]: fullName } },
        ],
        ...dateFilter,
      },
      include: [
        {
          model: model.FundsAuditStudent,
          attributes: [
            "id",
            "fundsAuditId",
            "registeredUserId",
            "firstName",
            "lastName",
            "phoneNumber",
            "email",
            "dateOfPayment",
            "dateOfDownload",
            "hasPaid",
            "isDownloaded",
            "queryStatus",
            "isQueryRaised",
            "occupation",
            "teamManager",
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
      raw: false, // Must be false to include associations
      nest: true, // Keep nested structure
    });

    // Fetch all managers for reference
    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email"],
      raw: true,
    });

    // Return response in the same format
    return res.json({
      success: true,
      resumesAchieved: resumes.length,
      resumesData: resumes,
      managers,
    });
  } catch (error) {
    console.error("Error in getUserResumesAchieved:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports.getUserResumesAchieved = getUserResumesAchieved;


const getUserInterviewsAchieved = async (req, res) => {
  try {
    const { fromDate, toDate, teamManagerId } = req.query;

    if (!teamManagerId) {
      return res.status(400).json({ success: false, error: "teamManagerId is required" });
    }

    const user = await model.User.findOne({
      where: { id: teamManagerId },
      attributes: ["firstName", "lastName"],
      raw: true,
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Make sure date range is provided
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, error: "fromDate and toDate are required" });
    }

    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);

    // Fetch only resumes with isRegistered true and in the given date range
    const registrations = await model.StudentResume.findAll({
      where: {
        teamManagerId,
        isRegistered: true, // strictly true
        resumeDate: { [Op.between]: [startDate, endDate] }, // filter by date
      },
      raw: true,
    });

    return res.json({
      success: true,
      interviewsAchieved: registrations.length, // count of only true registrations
      interviewsData: registrations,
    });
  } catch (error) {
    console.error("Error in getUserInterviewsAchieved:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports.getUserInterviewsAchieved = getUserInterviewsAchieved;

const listResumesByUserIdfuture = async (req, res) => {
  try {
    const teamManagerId = req.query.teamManagerId || req.params.teamManagerId;
    if (!teamManagerId) return ReE(res, "teamManagerId is required", 400);

    // ---------------------------
    // Fetch manager info
    // ---------------------------
    const manager = await model.TeamManager.findOne({
      where: { id: teamManagerId },
      attributes: ["name"],
      raw: true,
    });
    if (!manager) return ReE(res, "Manager not found", 404);

    const fullName = manager.name.trim();

    // ---------------------------
    // Compute tomorrow's date
    // ---------------------------
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // ---------------------------
    // Fetch future resumes with FundsAuditStudent
    // ---------------------------
    const resumes = await model.StudentResume.findAll({
      where: {
        teamManagerId,
        [Op.or]: [
          { followupBy: { [Op.iLike]: fullName } },
          { followupBy: { [Op.iLike]: fullName } },
        ],
        resumeDate: { [Op.gte]: tomorrow },
      },
      include: [
        {
          model: model.FundsAuditStudent,
          attributes: [
            "id",
            "fundsAuditId",
            "registeredUserId",
            "firstName",
            "lastName",
            "phoneNumber",
            "email",
            "dateOfPayment",
            "dateOfDownload",
            "hasPaid",
            "isDownloaded",
            "queryStatus",
            "isQueryRaised",
            "occupation",
            "teamManager",
          ],
        },
      ],
      order: [["resumeDate", "ASC"]],
    });

    // ---------------------------
    // Return response
    // ---------------------------
    return ReS(res, {
      success: true,
      teamManagerId,
      followUpBy: fullName,
      totalRecords: resumes.length,
      data: resumes,
    });
  } catch (error) {
    console.error("ListResumesByUserIdfuture Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.listResumesByUserIdfuture = listResumesByUserIdfuture;
