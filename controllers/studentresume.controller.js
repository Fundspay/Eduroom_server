"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, fn, col } = require("sequelize");
const { sendhrMail } = require("../middleware/mailerhr.middleware.js");


// Allowed values
const allowedInternshipTypes = ["fulltime", "parttime", "sip", "liveproject", "wip", "others"];
const allowedCourses = ["mba", "pgdm", "mba+pgdm", "bba/bcom", "engineering", "other"];

// ✅ Helper → accept ANY date format & convert safely
const toDate = (value) => {
  if (!value) return null;

  if (value instanceof Date && !isNaN(value)) return value;

  if (!isNaN(value)) {
    const d = new Date(Number(value));
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === "string") {
    const v = value.trim();

    const wordMatch = v.match(/^(\d{1,2})\s([A-Za-z]+)\s(\d{4})$/);
    if (wordMatch) {
      const day = parseInt(wordMatch[1], 10);
      const monthName = wordMatch[2].toLowerCase();
      const year = parseInt(wordMatch[3], 10);

      const months = {
        january: 1, jan: 1,
        february: 2, feb: 2,
        march: 3, mar: 3,
        april: 4, apr: 4,
        may: 5,
        june: 6, jun: 6,
        july: 7, jul: 7,
        august: 8, aug: 8,
        september: 9, sep: 9,
        october: 10, oct: 10,
        november: 11, nov: 11,
        december: 12, dec: 12,
      };

      if (months[monthName]) {
        return new Date(year, months[monthName] - 1, day);
      }
    }

    const numMatch = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (numMatch) {
      const day = parseInt(numMatch[1], 10);
      const month = parseInt(numMatch[2], 10);
      const year = parseInt(numMatch[3], 10);
      return new Date(year, month - 1, day);
    }

    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
};


const createResume = async (req, res) => {
  try {
    const dataArray = Array.isArray(req.body) ? req.body : [req.body];
    console.log("Incoming rows:", dataArray.length);

    const teamManagerId = req.body.teamManagerId ?? req.user?.id ?? null;

    let coSheetId = null;
    if (teamManagerId) {
      try {
        const coSheet = await model.CoSheet.findOne({ where: { teamManagerId } });
        if (coSheet) coSheetId = coSheet.id;
      } catch (err) {
        console.warn("CoSheet lookup failed:", err.message);
      }
    }

    // Remove completely empty rows
    const cleanedArray = dataArray.filter(d =>
      d && Object.values(d).some(v => v !== null && v !== undefined && v !== "")
    );
    console.log("After empty-row cleanup:", cleanedArray.length);

    // Map to raw payloads
    let payloads = cleanedArray.map(data => ({
      sr: data.sr ?? null,
      resumeDate: toDate(data.resumeDate),
      collegeName: String(data.collegeName || "").trim(),
      course: data.course ?? null,
      internshipType: data.internshipType ?? null,
      followupBy: data.followupBy ?? null,
      studentName: String(data.studentName || "").trim(),
      mobileNumber: String(data.mobileNumber || "").replace(/\s/g, ""), // remove all whitespace
      emailId: String(data.emailId || "").trim(),
      domain: data.domain ?? null,
      interviewDate: toDate(data.interviewDate),
      dateOfOnboarding: toDate(data.dateOfOnboarding) ?? null,
      coSheetId,
      teamManagerId,
      callStatus: data.callStatus ?? null,
      alloted: data.alloted ?? null,
    }));

    // Remove internal duplicates in payload
    const seenMobiles = new Set();
    const beforeInternalDup = payloads.length;
    payloads = payloads.filter(p => {
      if (seenMobiles.has(p.mobileNumber)) return false;
      seenMobiles.add(p.mobileNumber);
      return true;
    });
    console.log("Removed internal duplicates:", beforeInternalDup - payloads.length);

    // Remove DB duplicates
    const mobileNumbers = payloads.map(p => p.mobileNumber);
    const existing = await model.StudentResume.findAll({
      where: { mobileNumber: { [Op.in]: mobileNumbers } },
      attributes: ["mobileNumber"]
    });

    const existingMobiles = new Set(existing.map(e => String(e.mobileNumber).replace(/\s/g, "")));
    console.log("Existing DB mobiles found:", existingMobiles.size);

    const beforeDBDup = payloads.length;
    payloads = payloads.filter(p => !existingMobiles.has(p.mobileNumber));
    console.log("Removed DB duplicates:", beforeDBDup - payloads.length);

    console.log("Final payload count for insert:", payloads.length);
    if (payloads.length > 0) console.log("Sample payload:", payloads[0]);

    let records = [];
    try {
      records = await model.StudentResume.bulkCreate(payloads, {
        returning: true,
        ignoreDuplicates: true,
      });
      console.log("Bulk insert success, inserted:", records.length);
    } catch (err) {
      console.error("Bulk insert failed:", err);
    }

    return res.status(200).json({
      success: true,
      inserted: records.length,
      totalSent: Array.isArray(req.body) ? req.body.length : 1,
    });

  } catch (error) {
    console.error("StudentResume Create Error:", error);
    return res.status(200).json({
      success: false,
      inserted: 0,
      totalSent: Array.isArray(req.body) ? req.body.length : 1,
      warning: error.message,
    });
  }
};

module.exports.createResume = createResume;




//  Update Resume Record
const updateResume = async (req, res) => {
  try {
    const record = await model.StudentResume.findByPk(req.params.id);
    if (!record) return ReE(res, "Resume record not found", 404);

    const updates = {};
    const allowedFields = [
      "sr", "resumeDate", "collegeName", "course", "internshipType",
      "followupBy", "studentName", "mobileNumber", "emailId",
      "domain", "interviewDate", "teamManagerId", "Dateofonboarding",
      "callStatus",
      "alloted",
      "knowledgeScore","approachScore","skillsScore","otherScore","totalAverageScore","finalSelectionStatus","comment","interviewedBy"
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

    // ⭐ NEW LOGIC ADDED (as requested)
    const k = updates.knowledgeScore ?? record.knowledgeScore;
    const a = updates.approachScore ?? record.approachScore;
    const s = updates.skillsScore ?? record.skillsScore;
    const o = updates.otherScore ?? record.otherScore;

    const allEmpty =
      (k === null || k === undefined || k === "") &&
      (a === null || a === undefined || a === "") &&
      (s === null || s === undefined || s === "") &&
      (o === null || o === undefined || o === "");

    if (!allEmpty) {
      const numericValues = [k, a, s, o]
        .map(v => Number(v))
        .filter(v => !isNaN(v));

      updates.totalAverageScore =
        numericValues.length > 0
          ? Number((numericValues.reduce((x, y) => x + y, 0) / numericValues.length).toFixed(2))
          : null;
    } else {
      updates.totalAverageScore = null;
    }
    // ⭐ END OF NEW LOGIC

    // ✅ Ensure coSheetId matches teamManagerId
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


const listResumes = async (req, res) => {
  try {
    console.log("Starting StudentResume list...");

    // DATE RANGE HANDLING (UNCHANGED)
    let { startDate, endDate } = req.query;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!startDate || !endDate) {
      startDate = today;
      endDate = new Date(today);
    } else {
      startDate = new Date(startDate);
      endDate = new Date(endDate);
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email"],
      raw: true,
    });

    // 1️⃣ FETCH RESUMES (LOAD REDUCED, OUTPUT SAME)
    console.log("Fetching all resumes with associations...");
    const records = await model.StudentResume.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      },
      attributes: {
        include: ["callStatus", "alloted"],
      },
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
              required: false, // ❌ separate removed
            },
            { model: model.TeamManager, as: "teamManager", attributes: ["id", "name", "email"] },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: 500, // safety limit (frontend unchanged)
    });

    console.log(`Total resumes fetched: ${records.length}`);

    // 2️⃣ BULK USER FETCH (NO N+1)
    const users = await model.User.findAll({
      attributes: ["id", "phoneNumber", "email"],
      raw: true,
    });

    const phoneMap = new Map();
    const emailMap = new Map();

    for (const u of users) {
      if (u.phoneNumber) phoneMap.set(u.phoneNumber, u.id);
      if (u.email) emailMap.set(u.email, u.id);
    }

    //  ADD userId PER RECORD (OUTPUT SAME)
    for (const resume of records) {
      let userId = null;

      if (resume.user && resume.user.id) {
        userId = resume.user.id;
      } else {
        if (resume.mobileNumber) {
          userId = phoneMap.get(resume.mobileNumber) || null;
        }

        if (!userId && resume.emailId) {
          userId = emailMap.get(resume.emailId) || null;
        }
      }

      resume.dataValues.userId = userId;
    }

    console.log(" All processing done successfully!");
    return ReS(res, { success: true, data: records, managers }, 200);

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

    const managerName = manager.name;  //  we will match this with followupBy

    // ---------------------------
    // Fetch resumes WHERE followupBy == managerName
    // ---------------------------
    const resumes = await model.StudentResume.findAll({
      where: { interviewedBy: managerName },  //  UPDATED EXACTLY AS YOU ASKED
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
    });

    // ---------------------------
    // Fetch all managers
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

    const now = new Date();

    // Default range: from 1st of current month to today if fromDate/toDate not provided
    let startDate = fromDate
      ? new Date(fromDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);

    let endDate = toDate
      ? new Date(toDate)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate.setHours(23, 59, 59, 999);

    // RESUMES & COLLEGES COUNT — same as fetchMasterSheetTargets
    const resumes = await model.StudentResume.findAll({
      where: {
        interviewedBy: userName,
        [Op.or]: [
          { Dateofonboarding: { [Op.between]: [startDate, endDate] } },
          { Dateofonboarding: null, updatedAt: { [Op.between]: [startDate, endDate] } },
        ],
      },
      attributes: ["collegeName", "resumeDate", "Dateofonboarding", "updatedAt"],
      raw: true,
    });

    const collegeSet = new Set();
    resumes.forEach((r) => {
      if (r.collegeName) collegeSet.add(r.collegeName);
    });

    const collegesAchieved = collegeSet.size;
    const resumesAchieved = resumes.length;

    // RESUME SELECTED COUNT — same logic as fetchMasterSheetTargets
    const resumeSelectedCount = await model.StudentResume.count({
      where: {
        interviewedBy: userName,
        finalSelectionStatus: "Selected",
        Dateofonboarding: { [Op.between]: [startDate, endDate] },
      },
    });

    //  FIX: TARGET DATE RANGE LOGIC
    let targetStartDate;
    let targetEndDate;

    if (fromDate || toDate) {
      targetStartDate = startDate;
      targetEndDate = endDate;
    } else {
      targetStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
      targetEndDate = new Date(now);
      targetStartDate.setHours(0, 0, 0, 0);
      targetEndDate.setHours(23, 59, 59, 999);
    }

    // Fetch target data (FIXED)
    const targets = await model.MyTarget.findAll({
      where: {
        teamManagerId,
        targetDate: { [Op.between]: [targetStartDate, targetEndDate] },
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

    const result = [
      {
        followupBy: userName,
        collegeTarget: Number(targetData.collegeTarget),
        collegesAchieved,
        interviewsTarget: Number(targetData.interviewsTarget),
        interviewsAchieved: resumes.length,
        resumesReceivedTarget: Number(targetData.resumesReceivedTarget),
        resumesAchieved,
        resumeDates: resumes.map(r => r.Dateofonboarding || r.updatedAt),
        interviewDates: resumes.map(r => r.Dateofonboarding || r.updatedAt),
        resumeSelectedCount,
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

//  USER RESUMES ACHIEVED (SELECTED ONLY, INTERVIEW DATE BASED)
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
    if (!manager)
      return res.status(404).json({ success: false, error: "Manager not found" });

    const fullName = manager.name.trim();

    // Date filter (INTERVIEW DATE)
    let dateFilter = {};
    if (fromDate && toDate) {
      const startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);

      dateFilter = {
        Dateofonboarding: { [Op.between]: [startDate, endDate] },
      };
    }

    // Fetch ONLY SELECTED resumes for individual manager
    const resumes = await model.StudentResume.findAll({
      where: {
        teamManagerId,
        interviewedBy: fullName,
        finalSelectionStatus: "Selected",
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
      order: [["Dateofonboarding", "ASC"]],
      raw: false,
      nest: true,
    });

    // Fetch all managers (UNCHANGED)
    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email"],
      raw: true,
    });

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
    // Fetch all registered managers  ⭐ ADDED AS REQUESTED
    // ---------------------------
    const managers = await model.TeamManager.findAll({
      attributes: ["id", "name", "email"],
      raw: true,
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
      managers,   // ⭐ ADDED HERE
    });
  } catch (error) {
    console.error("ListResumesByUserIdfuture Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.listResumesByUserIdfuture = listResumesByUserIdfuture;

