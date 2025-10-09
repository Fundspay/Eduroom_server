"use strict";
const model = require("../models/index");
const sequelize = model.sequelize;
const { ReE, ReS } = require("../utils/util.service.js");
const axios = require("axios");
const { Op } = require("sequelize");
const dayjs = require("dayjs");
model.InternshipStatus = require("../models/status.model.js");
const { sendMail } = require("../middleware/mailer.middleware");
 


const addOrUpdateCourseDetail = async (req, res) => {
  const { domainId, userId, courseId, coursePreviewId, days } = req.body;

  if (!domainId) return ReE(res, "domainId is required", 400);
  if (!courseId) return ReE(res, "courseId is required", 400);
  if (!coursePreviewId) return ReE(res, "coursePreviewId is required", 400);
  if (!Array.isArray(days) || days.length === 0)
    return ReE(res, "days are required", 400);

  const transaction = await sequelize.transaction();
  try {
    const course = await model.Course.findByPk(courseId);
    if (!course || course.isDeleted) throw new Error("Course not found");

    const coursePreview = await model.CoursePreview.findByPk(coursePreviewId);
    if (!coursePreview || coursePreview.isDeleted)
      throw new Error("Course Preview not found");

    const createdDays = [];

    for (const dayObj of days) {
      const { day, sessions } = dayObj;
      if (day === undefined || day === null)
        throw new Error("day is required for each day object");
      if (!Array.isArray(sessions) || sessions.length === 0)
        throw new Error(`sessions are required for day ${day}`);

      const updatedSessions = [];

      for (const session of sessions) {
        const {
          sessionNumber,
         minBusinessTarget,
          title,
          description,
          youtubeLink,
          duration,
          sessionDuration,
          heading,
          questions,
        } = session;

        if (sessionNumber === undefined || sessionNumber === null)
          throw new Error("sessionNumber is required for each session");
        if (!title) throw new Error("title is required for each session");

        // Find or create session row
        let currentSessionRow = await model.CourseDetail.findOne({
          where: { courseId, coursePreviewId, day, sessionNumber },
          transaction,
        });

        if (!currentSessionRow) {
          currentSessionRow = await model.CourseDetail.create(
            {
              domainId,
              courseId,
              coursePreviewId,
              userId: userId ?? null,
              day,
              sessionNumber,
              minBusinessTarget,
              title,
              description: description ?? null,
              youtubeLink: youtubeLink ?? null,
              duration,
              sessionDuration,
              heading,
            },
            { transaction }
          );
        } else {
          await currentSessionRow.update(
            {
              title,
              description: description ?? null,
              youtubeLink: youtubeLink ?? null,
              duration,
              sessionDuration,
              minBusinessTarget,
              heading,
            },
            { transaction }
          );
        }

        // Save MCQs + Case Study in QuestionModel with questionNumber
        if (Array.isArray(questions)) {
          const existingQuestions = await model.QuestionModel.findAll({
            where: { courseDetailId: currentSessionRow.id, sessionNumber },
            transaction,
          });

          const existingQuestionMap = {};
          existingQuestions.forEach((q) => (existingQuestionMap[q.id] = q));
          const incomingIds = [];

          for (let index = 0; index < questions.length; index++) {
            const q = questions[index];
            const qId = Number(q.id);

            if (qId && existingQuestionMap[qId]) {
              await existingQuestionMap[qId].update(
                {
                  question: q.question,
                  optionA: q.optionA,
                  optionB: q.optionB,
                  optionC: q.optionC,
                  optionD: q.optionD,
                  answer: q.answer,
                  keywords: q.keywords ?? null,
                  caseStudy: q.caseStudy ?? null,
                  questionNumber: index + 1, // explicit question number
                },
                { transaction }
              );
              incomingIds.push(qId);
            } else {
              const newQ = await model.QuestionModel.create(
                {
                  courseDetailId: currentSessionRow.id,
                  domainId,
                  courseId,
                  coursePreviewId,
                  day,
                  sessionNumber,
                  minBusinessTarget,
                  question: q.question,
                  optionA: q.optionA,
                  optionB: q.optionB,
                  optionC: q.optionC,
                  optionD: q.optionD,
                  answer: q.answer,
                  keywords: q.keywords ?? null,
                  caseStudy: q.caseStudy ?? null,
                  questionNumber: index + 1, // explicit question number
                },
                { transaction }
              );
              incomingIds.push(newQ.id);
            }
          }

          // Delete old questions not in payload
          const toDelete = existingQuestions.filter(
            (q) => !incomingIds.includes(q.id)
          );
          if (toDelete.length > 0) {
            const deleteIds = toDelete.map((q) => q.id);
            await model.QuestionModel.destroy({
              where: { id: deleteIds },
              transaction,
            });
          }
        }

        updatedSessions.push({
          sessionNumber,
          title,
          description: description ?? null,
          youtubeLink: youtubeLink ?? null,
          duration,
          sessionDuration,
          minBusinessTarget,
          heading,
          questions,
        });
      }

      createdDays.push({ day, sessions: updatedSessions });
    }

    await transaction.commit();
    return ReS(res, { success: true, days: createdDays }, 201);
  } catch (error) {
    await transaction.rollback();
    console.error("Add/Update Course Details Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.addOrUpdateCourseDetail = addOrUpdateCourseDetail;

const deleteCourseDetail = async (req, res) => {
  const { courseDetailId, courseId, day, sessionNumber } = req.params;

  if (!courseDetailId && (!courseId || !day || !sessionNumber)) {
    return ReE(
      res,
      "Either courseDetailId OR (courseId, day, sessionNumber) is required",
      400
    );
  }

  const transaction = await sequelize.transaction();
  try {
    let courseDetail;

    if (courseDetailId) {
      // Delete by primary key
      courseDetail = await model.CourseDetail.findByPk(courseDetailId, {
        transaction,
      });
    } else {
      // Delete by courseId + day + sessionNumber
      courseDetail = await model.CourseDetail.findOne({
        where: { courseId, day, sessionNumber },
        transaction,
      });
    }

    if (!courseDetail) {
      await transaction.rollback();
      return ReE(res, "CourseDetail not found", 404);
    }

    // Delete associated questions
    await model.QuestionModel.destroy({
      where: { courseDetailId: courseDetail.id },
      transaction,
    });

    // Hard delete CourseDetail
    await courseDetail.destroy({ transaction });

    await transaction.commit();
    return ReS(
      res,
      {
        success: true,
        message: "CourseDetail and associated questions deleted successfully",
      },
      200
    );
  } catch (error) {
    await transaction.rollback();
    console.error("Delete CourseDetail Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.deleteCourseDetail = deleteCourseDetail;

// ✅ Fetch all CourseDetails by coursePreviewId (with MCQs)
var fetchCourseDetailsByPreview = async (req, res) => {
  const { coursePreviewId } = req.params;
  if (!coursePreviewId) return ReE(res, "coursePreviewId is required", 400);

  try {
    const coursePreview = await model.CoursePreview.findByPk(coursePreviewId);
    if (!coursePreview || coursePreview.isDeleted)
      return ReE(res, "Course Preview not found", 404);

    const courseDetails = await model.CourseDetail.findAll({
      where: { coursePreviewId, isDeleted: false },
      order: [
        ["day", "ASC"],
        ["sessionNumber", "ASC"],
      ],
      attributes: [
        "id",
        "day",
        "sessionNumber",
        "minBusinessTarget",
        "title",
        "heading",
        "description",
        "youtubeLink",
        "duration",
        "sessionDuration",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: model.QuestionModel,
          where: { isDeleted: false },
          required: false,
          attributes: [
            "id",
            "question",
            "optionA",
            "optionB",
            "optionC",
            "optionD",
            "answer",
            "keywords",
            "caseStudy",
            "sessionNumber",
            "minBusinessTarget",
          ],
        },
        {
          model: model.Course,
          attributes: ["id", "name"], // Include course name
        },
        {
          model: model.Domain,
          attributes: ["id", "name"], // Include domain name
        },
      ],
    });

    return ReS(res, { success: true, data: courseDetails }, 200);
  } catch (error) {
    console.error("Fetch Course Details Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.fetchCourseDetailsByPreview = fetchCourseDetailsByPreview;

// ✅ Fetch CourseDetails by coursePreviewId, day, and sessionNumber (GET request)
var fetchCourseDetailsByDayAndSession = async (req, res) => {
  const { coursePreviewId } = req.params;
  const { day, sessionNumber } = req.query; // frontend will send these as query params

  if (!coursePreviewId) return ReE(res, "coursePreviewId is required", 400);
  if (!day) return ReE(res, "day is required", 400);
  if (!sessionNumber) return ReE(res, "sessionNumber is required", 400);

  try {
    // Get the course preview first
    const coursePreview = await model.CoursePreview.findByPk(coursePreviewId);
    if (!coursePreview || coursePreview.isDeleted)
      return ReE(res, "Course Preview not found", 404);

    // Fetch all course details like existing API
    const courseDetails = await model.CourseDetail.findAll({
      where: { coursePreviewId, isDeleted: false },
      order: [
        ["day", "ASC"],
        ["sessionNumber", "ASC"],
      ],
      attributes: [
        "id",
        "day",
        "sessionNumber",
        "title",
        "heading",
        "description",
        "youtubeLink",
        "duration",
        "sessionDuration",
        "minBusinessTarget",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: model.QuestionModel,
          where: { isDeleted: false },
          required: false,
          attributes: [
            "id",
            "question",
            "optionA",
            "optionB",
            "optionC",
            "optionD",
            "answer",
            "keywords",
            "caseStudy",
            "sessionNumber",
            "minBusinessTarget",
          ],
        },
        {
          model: model.Course,
          attributes: ["id", "name"],
        },
        {
          model: model.Domain,
          attributes: ["id", "name"],
        },
      ],
    });

    // Filter by day and sessionNumber
    const filteredDetails = courseDetails.filter(
      (cd) => cd.day == day && cd.sessionNumber == sessionNumber
    );

    return ReS(res, { success: true, data: filteredDetails }, 200);
  } catch (error) {
    console.error("Fetch Course Details by Day/Session Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchCourseDetailsByDayAndSession =
  fetchCourseDetailsByDayAndSession;

//  Evaluate MCQs for a specific course + course preview + day

const evaluateSessionMCQ = async (req, res) => {
  try {
    const { courseId, coursePreviewId, day, sessionNumber } = req.params;
    const { userId, answers } = req.body;

    if (!userId || !Array.isArray(answers)) {
      return ReE(res, "userId and answers are required", 400);
    }

    // Fetch session details with MCQs
    const sessionDetail = await model.CourseDetail.findOne({
      where: {
        courseId,
        coursePreviewId,
        day,
        sessionNumber,
        isDeleted: false,
      },
      include: [
        {
          model: model.QuestionModel,
          where: { isDeleted: false },
          required: false,
        },
      ],
    });

    if (!sessionDetail) return ReE(res, "Session details not found", 404);

    const mcqs = sessionDetail.QuestionModels || [];
    if (mcqs.length === 0)
      return ReE(res, "No MCQs found for this session", 404);

    let correctCount = 0;
    const results = [];

    // Evaluate each answer
    for (let ans of answers) {
      const mcq = mcqs.find((m) => String(m.id) === String(ans.mcqId));
      if (!mcq) continue;

      const isCorrect =
        String(mcq.answer).toUpperCase() ===
        String(ans.selectedOption).toUpperCase();
      if (isCorrect) correctCount++;

      results.push({
        mcqId: mcq.id,
        question: mcq.question,
        selectedOption: ans.selectedOption,
        isCorrect,
        correctAnswer: mcq.answer,
        keywords: mcq.keywords || null,
        caseStudy: mcq.caseStudy || null,
      });
    }

    const total = mcqs.length;
    const score = `${correctCount}/${total}`;

    // Normalize existing userProgress
    let progress = {};
    if (sessionDetail.userProgress) {
      progress =
        typeof sessionDetail.userProgress === "string"
          ? JSON.parse(sessionDetail.userProgress)
          : sessionDetail.userProgress;
    }

    // Save both score and selected answers
    progress[userId] = {
      correctMCQs: correctCount,
      totalMCQs: total,
      eligibleForCaseStudy: correctCount === total,
      answers: results, // store the evaluated answers too
    };

    // Update DB
    await model.CourseDetail.update(
      { userProgress: progress },
      { where: { id: sessionDetail.id } }
    );

    return ReS(
      res,
      {
        success: true,
        courseDetail: sessionDetail,
        questions: mcqs,
        evaluation: {
          totalQuestions: total,
          correct: correctCount,
          wrong: total - correctCount,
          score,
          eligibleForCaseStudy: correctCount === total,
          results,
        },
      },
      200
    );
  } catch (error) {
    console.error("Evaluate Session MCQ Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.evaluateSessionMCQ = evaluateSessionMCQ;

// const getCaseStudyForSession = async (req, res) => {
//   try {
//     const { courseId, coursePreviewId, day, sessionNumber } = req.params;
//     const { userId } = req.query;

//     if (!userId) return ReE(res, "userId is required", 400);

//     // Fetch the first question in this session that has a case study
//     const caseStudyQuestion = await model.QuestionModel.findOne({
//       where: {
//         courseId,
//         coursePreviewId,
//         day,
//         sessionNumber,
//         isDeleted: false,
//         caseStudy: { [Op.ne]: null }  // not null
//       },
//       order: [['questionNumber', 'ASC']]  // ensures first question with case study
//     });

//     if (!caseStudyQuestion) {
//       return ReS(res, {
//         success: false,
//         message: "No case study available for this session."
//       }, 200);
//     }

//     // Response exactly like frontend expects
//     return ReS(res, {
//       success: true,
//       data: {
//         caseStudy: {
//           questionId: caseStudyQuestion.id,
//           caseStudy: caseStudyQuestion.caseStudy
//         }
//       }
//     }, 200);

//   } catch (error) {
//     console.error("Get Case Study Error:", error);
//     return ReE(res, error.message, 500);
//   }
// };

// module.exports.getCaseStudyForSession = getCaseStudyForSession;
const getCaseStudyForSession = async (req, res) => {
  try {
    const { courseId, coursePreviewId, day, sessionNumber } = req.params;
    const { userId } = req.query;

    if (!userId) return ReE(res, "userId is required", 400);

    const sessionDetail = await model.CourseDetail.findOne({
      where: {
        courseId,
        coursePreviewId,
        day,
        sessionNumber,
        isDeleted: false,
      },
      include: [
        {
          model: model.QuestionModel,
          where: { isDeleted: false },
          required: false, // keep false so sessions without questions still return
        },
      ],
    });

    if (!sessionDetail) return ReE(res, "Session details not found", 404);

    // Ensure we look into all questions for this session row
    const caseStudyQuestion = (sessionDetail.QuestionModels || []).find(
      (q) => q.caseStudy && q.caseStudy.trim() !== ""
    );
    if (!caseStudyQuestion) {
      return ReS(
        res,
        {
          success: false,
          message: "No Case Study available for this session.",
        },
        200
      );
    }

    return ReS(
      res,
      {
        success: true,
        data: {
          userId,
          courseId,
          coursePreviewId,
          day,
          sessionNumber,
          caseStudy: {
            questionId: caseStudyQuestion.id,
            caseStudy: caseStudyQuestion.caseStudy,
          },
        },
      },
      200
    );
  } catch (error) {
    console.error("Get Case Study Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCaseStudyForSession = getCaseStudyForSession;

const submitCaseStudyAnswer = async (req, res) => {
  try {
    const { courseId, coursePreviewId, day, sessionNumber, questionId } =
      req.params;
    const { userId, answer } = req.body;

    if (!userId || !answer)
      return ReE(res, "userId and answer are required", 400);

    // Fetch case study question
    const question = await model.QuestionModel.findOne({
      where: {
        id: questionId,
        courseId,
        coursePreviewId,
        day,
        sessionNumber,
        isDeleted: false,
        caseStudy: { [model.Sequelize.Op.ne]: null },
      },
    });

    if (!question) return ReE(res, "Case Study not found", 404);

    // Evaluate answer using keywords
    const keywords = question.keywords ? question.keywords.split(",") : [];
    const userAnswerLower = answer.toLowerCase();
    let matchedCount = 0;

    keywords.forEach((kw) => {
      if (userAnswerLower.includes(kw.trim().toLowerCase())) matchedCount++;
    });

    const matchPercentage = (matchedCount / (keywords.length || 1)) * 100;
    const passed = matchPercentage >= 33;

    // ✅ Upsert result (insert if not exists, update if exists)
    await model.CaseStudyResult.upsert({
      userId,
      courseId,
      coursePreviewId,
      day,
      sessionNumber,
      questionId,
      answer,
      matchPercentage,
      passed,
    });

    return ReS(
      res,
      {
        success: true,
        data: {
          userId,
          courseId,
          coursePreviewId,
          day,
          sessionNumber,
          questionId,
          matchPercentage,
          passed,
          message: passed
            ? "You have passed this Case Study"
            : "You did not pass. Try again.",
        },
      },
      200
    );
  } catch (error) {
    console.error("Submit Case Study Answer Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.submitCaseStudyAnswer = submitCaseStudyAnswer;

// ✅ Session-wise status for a user
const getSessionStatusPerUser = async (req, res) => {
  try {
    const { courseId, coursePreviewId, userId } = req.params;
    if (!userId) return ReE(res, "userId is required", 400);

    const sessions = await model.CourseDetail.findAll({
      where: { courseId, coursePreviewId, isDeleted: false },
      order: [
        ["day", "ASC"],
        ["sessionNumber", "ASC"],
      ],
    });

    if (!sessions.length)
      return ReE(res, "No sessions found for this course", 404);

    const sessionStatus = sessions.map((session) => {
      const progress = session.userProgress?.[userId];
      return {
        day: session.day,
        sessionNumber: session.sessionNumber,
        title: session.title,
        attempted: !!progress,
        correctMCQs: progress?.correctMCQs || 0,
        totalMCQs: progress?.totalMCQs || 0,
      };
    });

    return ReS(
      res,
      {
        success: true,
        totalSessions: sessions.length,
        sessionStatus,
      },
      200
    );
  } catch (error) {
    console.error("Get Session Status Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getSessionStatusPerUser = getSessionStatusPerUser;

// ✅ Overall course status for a user
const getOverallCourseStatus = async (req, res) => {
  try {
    const { courseId, coursePreviewId, userId } = req.params;
    if (!userId) return ReE(res, "userId is required", 400);

    const sessions = await model.CourseDetail.findAll({
      where: { courseId, coursePreviewId, isDeleted: false },
      order: [
        ["day", "ASC"],
        ["sessionNumber", "ASC"],
      ],
    });

    if (!sessions.length)
      return ReE(res, "No sessions found for this course", 404);

    // ✅ Deduplicate sessions (keep only unique day+sessionNumber)
    const uniqueSessions = [];
    const seen = new Set();
    for (const s of sessions) {
      const key = `${s.day}-${s.sessionNumber}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueSessions.push(s);
      }
    }

    let completedSessions = 0;
    const daysMap = {};

    uniqueSessions.forEach((session) => {
      const progress = session.userProgress?.[userId];
      const attempted = !!progress;
      if (attempted) completedSessions++;

      if (!daysMap[session.day]) {
        daysMap[session.day] = { total: 0, completed: 0, sessions: [] };
      }

      daysMap[session.day].total++;
      if (attempted) daysMap[session.day].completed++;

      daysMap[session.day].sessions.push({
        sessionNumber: session.sessionNumber,
        title: session.title,
        attempted,
        correctMCQs: progress?.correctMCQs || 0,
        totalMCQs: progress?.totalMCQs || 0,
      });
    });

    const overallStatus = {
      totalDays: Object.keys(daysMap).length,
      totalSessions: uniqueSessions.length, // ✅ only unique sessions count
      completedSessions,
      completionRate:
        ((completedSessions / uniqueSessions.length) * 100).toFixed(2) + "%",
      days: daysMap,
    };

    return ReS(res, { success: true, overallStatus }, 200);
  } catch (error) {
    console.error("Get Overall Course Status Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getOverallCourseStatus = getOverallCourseStatus;

// ✅ Daily status per user
const getDailyStatusPerUser = async (req, res) => {
  try {
    const { courseId, coursePreviewId, userId } = req.params;
    if (!userId) return ReE(res, "userId is required", 400);
    if (!courseId) return ReE(res, "courseId is required", 400);

    // Fetch user
    const user = await model.User.findByPk(userId);
    if (!user) return ReE(res, "User not found", 404);

    // Fetch all sessions for the course & preview
    const sessions = await model.CourseDetail.findAll({
      where: { courseId, coursePreviewId, isDeleted: false },
      order: [
        ["day", "ASC"],
        ["sessionNumber", "ASC"],
      ],
    });

    if (!sessions.length)
      return ReE(res, "No sessions found for this course", 404);

    const daysMap = {};
    let totalSessions = 0;
    let completedSessions = 0;

    // Loop through sessions
    for (const session of sessions) {
      const progress = session.userProgress?.[userId] || {};
      const attempted = !!progress || true; // consider attempted if any progress

      let sessionCompletionPercentage = 0;
      let correctMCQs = 0;
      let totalMCQs = 0;
      let caseStudyPercentage = null;

      // --- Fetch latest case study result for this session ---
      const latestCaseStudy = await model.CaseStudyResult.findOne({
        where: {
          userId,
          courseId,
          coursePreviewId,
          day: session.day,
          sessionNumber: session.sessionNumber,
        },
        order: [["createdAt", "DESC"]],
      });

      if (latestCaseStudy) {
        caseStudyPercentage = latestCaseStudy.matchPercentage || 0;
        sessionCompletionPercentage = caseStudyPercentage;
      } else {
        // Fallback to MCQs
        totalMCQs = progress.totalMCQs || 0;
        correctMCQs = progress.correctMCQs || 0;
        sessionCompletionPercentage = totalMCQs
          ? ((correctMCQs / totalMCQs) * 100)
          : 0;
      }

      // Initialize day in map
      if (!daysMap[session.day])
        daysMap[session.day] = { total: 0, completed: 0, sessions: [] };
      daysMap[session.day].total++;
      totalSessions++;

      // Count completed sessions based on threshold (>=20%)
      const isCompleted = sessionCompletionPercentage >= 20 && attempted;
      if (isCompleted) {
        completedSessions++;
        daysMap[session.day].completed++;
      }

      // Determine status for this session
      const status = isCompleted ? "Completed" : "In Progress";

      // Prevent duplicate sessions
      const alreadyExists = daysMap[session.day].sessions.some(
        (s) => s.sessionNumber === session.sessionNumber
      );

      if (!alreadyExists) {
        daysMap[session.day].sessions.push({
          sessionNumber: session.sessionNumber,
          title: session.title,
          attempted,
          status,
          correctMCQs,
          totalMCQs,
          caseStudyPercentage,
          sessionDuration: session.sessionDuration || null,
          sessionCompletionPercentage: Number(sessionCompletionPercentage.toFixed(2)),
          minBusinessTarget: session.minBusinessTarget || null,
        });
      }
    }

    // --- Build dailyStatus array ---
    const dailyStatus = Object.keys(daysMap).map((dayKey) => {
      const d = daysMap[dayKey];
      const dayCompletionPercentage = ((d.completed / d.total) * 100).toFixed(2);
      return {
        day: Number(dayKey),
        totalSessions: d.total,
        completedSessions: d.completed,
        fullyCompleted: d.completed === d.total,
        dayCompletionPercentage: Number(dayCompletionPercentage),
        status: d.completed === d.total ? "Completed" : "In Progress",
        sessions: d.sessions,
      };
    });

    // --- Overall status ---
    const overallStatus =
      completedSessions === totalSessions ? "Completed" : "In Progress";
    const overallCompletionRate = totalSessions
      ? ((completedSessions / totalSessions) * 100).toFixed(2)
      : 0;

    // Update user's courseStatuses
    const existingStatuses = user.courseStatuses
      ? { ...user.courseStatuses }
      : {};
    existingStatuses[String(courseId)] = overallStatus;
    await user.update(
      { courseStatuses: existingStatuses },
      { fields: ["courseStatuses"] }
    );
    await user.reload();

    return ReS(
      res,
      {
        success: true,
        summary: {
          totalSessions,
          completedSessions,
          remainingSessions: totalSessions - completedSessions,
          overallCompletionRate: Number(overallCompletionRate),
          overallStatus,
        },
        dailyStatus,
      },
      200
    );
  } catch (error) {
    console.error("Get Daily Status Error:", error);
    return ReE(res, error.message || "Internal Server Error", 500);
  }
};

module.exports.getDailyStatusPerUser = getDailyStatusPerUser;

// ✅ Get daily status and wallet info for all courses of a user
const getDailyStatusAllCoursesPerUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return ReE(res, "userId is required", 400);

    // Fetch user instance
    let user = await model.User.findByPk(userId);
    if (!user) return ReE(res, "User not found", 404);

    await user.reload(); // latest values

    // Prepare response with subscription fields
    const response = {
      userId: user.id,
      fullName: user.fullName || `${user.firstName} ${user.lastName}`,
      subscriptionWallet: user.subscriptionWallet,
      subscriptiondeductedWallet: user.subscriptiondeductedWallet,
      subscriptionLeft: user.subscriptionLeft,
      courses: [],
    };

    const courseIds = Object.keys(user.courseStatuses || {});
    for (const courseId of courseIds) {
      const course = await model.Course.findOne({
        where: { id: courseId, isDeleted: false },
        include: [
          { model: model.Domain, attributes: ["name"] },
          {
            model: model.CoursePreview,
            attributes: ["id", "title", "heading"],
            where: { isDeleted: false },
            required: false,
          },
        ],
      });
      if (!course) continue;

      const sessions = await model.CourseDetail.findAll({
        where: { courseId, isDeleted: false },
        order: [
          ["day", "ASC"],
          ["sessionNumber", "ASC"],
        ],
      });

      const daysMap = {};
      let totalSessions = 0;
      let completedSessions = 0;

      for (const session of sessions) {
        const progress = session.userProgress?.[userId] || {};
        const attempted = !!progress;

        let sessionCompletionPercentage = 0;
        let correctMCQs = 0;
        let totalMCQs = 0;
        let caseStudyPercentage = null;

        // Fetch latest case study result
        const latestCaseStudy = await model.CaseStudyResult.findOne({
          where: {
            userId,
            courseId,
            day: session.day,
            sessionNumber: session.sessionNumber,
          },
          order: [["createdAt", "DESC"]],
        });

        if (latestCaseStudy) {
          caseStudyPercentage = latestCaseStudy.matchPercentage;
          sessionCompletionPercentage = caseStudyPercentage;
        } else {
          totalMCQs = progress.totalMCQs || 0;
          correctMCQs = progress.correctMCQs || 0;
          sessionCompletionPercentage = totalMCQs
            ? ((correctMCQs / totalMCQs) * 100).toFixed(2)
            : 0;
        }

        if (!daysMap[session.day])
          daysMap[session.day] = { total: 0, completed: 0, sessions: [] };
        daysMap[session.day].total++;
        totalSessions++;

        if (attempted && sessionCompletionPercentage > 0) {
          completedSessions++;
          daysMap[session.day].completed++;
        }

        const status = latestCaseStudy
          ? `${Number(sessionCompletionPercentage).toFixed(2)}%`
          : sessionCompletionPercentage >= 33
          ? "Completed"
          : "In Progress";

        daysMap[session.day].sessions.push({
          sessionNumber: session.sessionNumber,
          title: session.title,
          attempted,
          status,
          correctMCQs,
          totalMCQs,
          caseStudyPercentage,
          sessionDuration: session.sessionDuration || null,
          sessionCompletionPercentage: Number(sessionCompletionPercentage),
        });
      }

      const dailyStatus = Object.keys(daysMap).map((dayKey) => {
        const d = daysMap[dayKey];
        const dayCompletionPercentage = ((d.completed / d.total) * 100).toFixed(
          2
        );
        return {
          day: Number(dayKey),
          totalSessions: d.total,
          completedSessions: d.completed,
          fullyCompleted: d.completed === d.total,
          dayCompletionPercentage: Number(dayCompletionPercentage),
          status: d.completed === d.total ? "Completed" : "In Progress",
          sessions: d.sessions,
        };
      });

      const overallCompletionRate = totalSessions
        ? ((completedSessions / totalSessions) * 100).toFixed(2)
        : 0;

      // Check if business target is met
      const isBusinessTargetMet =
        user.subscriptionWallet >= (course.businessTarget || 0) &&
        user.subscriptiondeductedWallet >= (course.businessTarget || 0);

      // ✅ New: Check if all sessions >= 33% (including case study)
      const allSessionsAboveThreshold = await Promise.all(
        sessions.map(async (session) => {
          let sessionCompletionPercentage = 0;

          const latestCaseStudy = await model.CaseStudyResult.findOne({
            where: {
              userId,
              courseId,
              day: session.day,
              sessionNumber: session.sessionNumber,
            },
            order: [["createdAt", "DESC"]],
          });

          if (latestCaseStudy) {
            sessionCompletionPercentage = latestCaseStudy.matchPercentage;
          } else {
            const progress = session.userProgress?.[userId] || {};
            if (progress.totalMCQs && progress.correctMCQs !== undefined) {
              sessionCompletionPercentage =
                (progress.correctMCQs / progress.totalMCQs) * 100 || 0;
            }
          }

          return sessionCompletionPercentage >= 20;
        })
      ).then((results) => results.every(Boolean));

      // ✅ Final overallStatus logic
      let overallStatus = "In Progress";
      if (isBusinessTargetMet && allSessionsAboveThreshold) {
        overallStatus = "Completed";
      }

      // ✅ Check Status model for internshipStatus override
      const statusRecord = await model.Status.findOne({
        where: { userId, isDeleted: false },
      });

      if (statusRecord && statusRecord.internshipStatus) {
        const normalized = statusRecord.internshipStatus
          .trim()
          .toLowerCase()
          .replace(/[-_]/g, " ");

        if (["terminated"].includes(normalized)) {
          overallStatus = "Terminated";
        } else if (["on hold", "hold", "onhold"].includes(normalized)) {
          overallStatus = "On Hold";
        }
      }

      // Update user's courseStatuses
      const existingStatuses = user.courseStatuses
        ? { ...user.courseStatuses }
        : {};
      existingStatuses[String(courseId)] = overallStatus;
      await user.update(
        { courseStatuses: existingStatuses },
        { fields: ["courseStatuses"] }
      );

      response.courses.push({
        courseId,
        courseName: course.name,
        domainName: course.Domain?.name || null,
        businessTarget: course.businessTarget || 0,
        coursePreviews: course.CoursePreviews || [],
        overallStatus,
        overallCompletionRate: Number(overallCompletionRate),
        dailyStatus,
         startDate: user.courseDates?.[courseId]?.startDate || null,
         endDate: user.courseDates?.[courseId]?.endDate || null,
      });
    }

    return ReS(res, { success: true, data: response }, 200);
  } catch (error) {
    console.error("getDailyStatusAllCoursesPerUser error:", error);
    return ReE(res, error.message || "Internal Server Error", 500);
  }
};

module.exports.getDailyStatusAllCoursesPerUser =
  getDailyStatusAllCoursesPerUser;

const getBusinessTarget = async (req, res) => {
  try {
    let { userId, courseId } = req.params;

    console.log("Received params:", { userId, courseId });

    // Convert IDs to integers
    userId = parseInt(userId, 10);
    courseId = parseInt(courseId, 10);

    if (isNaN(userId) || isNaN(courseId)) {
      console.log("Invalid IDs provided");
      return ReE(res, "Invalid userId or courseId", 400);
    }

    // 1️⃣ Fetch user
    const user = await model.User.findByPk(userId);
    if (!user) {
      console.log(`User not found for ID: ${userId}`);
      return ReE(res, "User not found", 404);
    }

    // 2️⃣ Fetch course
    const course = await model.Course.findByPk(courseId);
    if (!course) {
      console.log(`Course not found for ID: ${courseId}`);
      return ReE(res, "Course not found", 404);
    }

    // 3️⃣ Extract business target
    const businessTarget = parseInt(course.businessTarget, 10) || 0;

    // 4️⃣ Fetch achieved referral count
    let achievedCount = 0;
    if (user.referralCode) {
      try {
        const apiUrl = `https://lc8j8r2xza.execute-api.ap-south-1.amazonaws.com/prod/auth/getReferralCount?referral_code=${user.referralCode}`;
        const apiResponse = await axios.get(apiUrl);

        // ✅ use the `count` field inside referral_count
        achievedCount = apiResponse.data?.referral_count?.count || 0;
      } catch (apiError) {
        console.warn("Referral API error:", apiError.message);
        achievedCount = 0;
      }
    }

    // 5️⃣ Safe numbers
    const achievedCountNum = Number(achievedCount) || 0;
    const alreadyDeducted = Number(user.subscriptiondeductedWallet || 0);

    // 6️⃣ Update wallet values
    const subscriptionWallet = achievedCountNum; // total achieved
    const subscriptionLeft = Math.max(subscriptionWallet - alreadyDeducted, 0);

    user.businessTargets = {
      ...user.businessTargets,
      [courseId]: businessTarget,
    };
    user.subscriptionWallet = subscriptionWallet;
    user.subscriptionLeft = subscriptionLeft;

    await user.save({
      fields: ["businessTargets", "subscriptionWallet", "subscriptionLeft"],
    });

    console.log(`Updated user ${user.id} with business target info`);

    // 7️⃣ Return response
    return ReS(
      res,
      {
        success: true,
        data: {
          userId: user.id,
          courseId,
          businessTarget,
          achievedCount: subscriptionWallet,
          totalDeducted: alreadyDeducted,
          subscriptionWallet,
          subscriptionLeft,
          businessTargets: user.businessTargets,
          startDate: user.courseDates?.[courseId]?.startDate || null,
          endDate: user.courseDates?.[courseId]?.endDate || null,
        },
      },
      200
    );
  } catch (error) {
    console.error("Get Business Target Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getBusinessTarget = getBusinessTarget;

const getBusinessUserTarget = async (req, res) => {
  try {
    let { userId } = req.params;

    console.log("Received params:", { userId });

    // Convert ID to integer
    userId = parseInt(userId, 10);

    if (isNaN(userId)) {
      console.log("Invalid userId provided");
      return ReE(res, "Invalid userId", 400);
    }

    // 1️⃣ Fetch user
    const user = await model.User.findByPk(userId);
    if (!user) {
      console.log(`User not found for ID: ${userId}`);
      return ReE(res, "User not found", 404);
    }

    // 2️⃣ Fetch business target from user data
    const businessTarget = parseInt(user.businessTarget, 10) || 0;

    // 3️⃣ Fetch achieved referral count
    let achievedCount = 0;
    if (user.referralCode) {
      try {
        const apiUrl = `https://lc8j8r2xza.execute-api.ap-south-1.amazonaws.com/prod/auth/getReferralCount?referral_code=${user.referralCode}`;
        const apiResponse = await axios.get(apiUrl);

        achievedCount = apiResponse.data?.referral_count?.count || 0;
      } catch (apiError) {
        console.warn("Referral API error:", apiError.message);
        achievedCount = 0;
      }
    }

    const achievedCountNum = Number(achievedCount) || 0;
    const alreadyDeducted = Number(user.subscriptiondeductedWallet || 0);

    // 4️⃣ Update wallet values properly
    const subscriptionWallet = achievedCountNum; // total achieved
    const subscriptionLeft = Math.max(subscriptionWallet - alreadyDeducted, 0);

    user.subscriptionWallet = subscriptionWallet;
    user.subscriptionLeft = subscriptionLeft;

    await user.save({
      fields: ["subscriptionWallet", "subscriptionLeft"],
    });

    console.log(`Updated user ${user.id} with business target info`);

    // 5️⃣ Return response
    return ReS(
      res,
      {
        success: true,
        data: {
          userId: user.id,
          businessTarget,
          achievedCount: subscriptionWallet,
          totalDeducted: alreadyDeducted,
          subscriptionWallet,
          subscriptionLeft,
          businessTargets: user.businessTargets,
        },
      },
      200
    );
  } catch (error) {
    console.error("Get Business User Target Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getBusinessUserTarget = getBusinessUserTarget;

const getCourseStatus = async (req, res) => {
  try {
    const { courseId, coursePreviewId, userId } = req.params;

    if (!userId) {
      return ReE(res, "userId is required", 400);
    }

    // 1. Fetch all sessions of this course
    const sessions = await model.CourseDetail.findAll({
      where: { courseId, coursePreviewId, isDeleted: false },
      include: [
        {
          model: model.QuestionModel,
          where: { isDeleted: false },
          required: false,
        },
      ],
      order: [
        ["day", "ASC"],
        ["sessionNumber", "ASC"],
      ],
    });

    if (!sessions || sessions.length === 0) {
      return ReE(res, "No course sessions found", 404);
    }

    // Counters
    const totalSessions = sessions.length;
    let completedSessions = 0;

    // 2. Build structured response
    const status = sessions.map((session) => {
      const progress = session.userProgress || {};
      const userProg = progress[userId] || {
        correctMCQs: 0,
        totalMCQs: session.QuestionModels.length,
      };

      // ✅ Session is completed if all MCQs attempted (correct or not)
      const isCompleted =
        userProg.correctMCQs === userProg.totalMCQs && userProg.totalMCQs > 0;
      if (isCompleted) completedSessions++;

      return {
        day: session.day,
        sessionNumber: session.sessionNumber,
        title: session.title,
        description: session.description,
        youtubeLink: session.youtubeLink,
        mcqProgress: userProg,
        status: isCompleted ? "Completed" : "In Progress",
      };
    });

    const remainingSessions = totalSessions - completedSessions;
    const overallStatus =
      completedSessions === totalSessions ? "Completed" : "In Progress";

    return ReS(
      res,
      {
        success: true,
        summary: {
          totalSessions,
          completedSessions,
          remainingSessions,
          overallStatus,
        },
        courseStatus: status,
      },
      200
    );
  } catch (err) {
    console.error("Get Course Status Error:", err);
    return ReE(res, err.message, 500);
  }
};

module.exports.getCourseStatus = getCourseStatus;

const setCourseStartEndDates = async (req, res) => {
  try {
    const { userId, courseId, startDate } = req.body;

    if (!userId || !courseId || !startDate) {
      return ReE(res, "userId, courseId, and startDate are required", 400);
    }

    // Fetch the user
    const user = await model.User.findByPk(userId);
    if (!user) return ReE(res, "User not found", 404);

    // Fetch the course to get duration and businessTarget
    const course = await model.Course.findByPk(courseId);
    if (!course || !course.duration) {
      return ReE(res, "Course not found or duration not set", 404);
    }

    // Calculate end date
    const start = dayjs(startDate);
    const durationDays = parseInt(course.duration, 10);
    const end = start.add(durationDays, "day");

    // Reload latest user data
    await user.reload();

    // Update user's courseDates JSON safely
    const courseDates = { ...(user.courseDates || {}) };
    courseDates[courseId] = {
      courseName: course.name,
      startDate: start.format("YYYY-MM-DD"),
      endDate: end.format("YYYY-MM-DD"),
      started: true,
    };

    user.courseDates = courseDates;
    await user.save();

    // Trigger internal Offer Letter API (non-blocking)
    try {
      await axios.post(
        `https://eduroom.in/api/v1/offerletter/send/${userId}/${courseId}`,
        {
          courseId,
          courseName: course.name,
          startDate: courseDates[courseId].startDate,
          endDate: courseDates[courseId].endDate,
        }
      );
      console.log(`Offer letter triggered for user ${userId}`);
    } catch (err) {
      console.error(`Failed to trigger offer letter for user ${userId}:`, err.message);
    }

    // 🔹 Send email to the user
    if (user.email) {
  const emailHtml = `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 10px; background-color: #fefefe;">
    <div style="text-align: center; margin-bottom: 20px;">
      <h2 style="color: #1a73e8;">🎯 New Live Project Assigned!</h2>
      <p style="color: #555;">Get ready to excel in your new Live Project 🚀</p>
    </div>

    <p>Hi <strong>${user.name || user.firstName || "User"}</strong> 👋,</p>

    <p>You have been enrolled in the Live Project <strong>${course.name}</strong>. Here are the details:</p>

    <ul>
      <li>📅 <strong>Start Date:</strong> ${courseDates[courseId].startDate}</li>
      <li>📅 <strong>End Date:</strong> ${courseDates[courseId].endDate}</li>
      <li>🎯 <strong>Business Target:</strong> ${course.businessTarget || "Not Assigned"}</li>
    </ul>

    <p>Tips to succeed in this Live Project:</p>
    <ul>
      <li>💡 Plan your sessions daily and stay consistent</li>
      <li>💪 Focus on completing your business targets</li>
      <li>🌟 Ask questions and leverage resources whenever needed</li>
    </ul>

    <p>We are excited to see your progress and achievements! 🚀</p>

    <p style="margin-top: 30px;">Best regards,<br/>
    <strong>EduRoom Team</strong></p>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
    <p style="font-size: 12px; color: #999;">This is an automated email. Please do not reply. For support, contact <a href="mailto:support@eduroom.com">support@eduroom.com</a>.</p>
  </div>
  `;

      const mailResult = await sendMail(user.email, `Course Details: ${course.name}`, emailHtml);
      if (!mailResult.success) {
        console.error(`Failed to send course email to user ${userId}`);
      }
    } else {
      console.warn(`User ${userId} has no email configured`);
    }

    return ReS(
      res,
      {
        success: true,
        message: "Course start and end dates updated successfully",
        data: {
          courseId,
          courseName: course.name,
          startDate: courseDates[courseId].startDate,
          endDate: courseDates[courseId].endDate,
          started: courseDates[courseId].started,
        },
      },
      200
    );
  } catch (error) {
    console.error("Set Course Start/End Dates Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.setCourseStartEndDates = setCourseStartEndDates;

const getUserMCQScore = async (req, res) => {
  try {
    const { courseId, coursePreviewId, day, sessionNumber, userId } =
      req.params;

    if (!userId) return ReE(res, "userId is required", 400);

    // Fetch the session detail
    const sessionDetail = await model.CourseDetail.findOne({
      where: {
        courseId,
        coursePreviewId,
        day,
        sessionNumber,
        isDeleted: false,
      },
    });

    if (!sessionDetail) return ReE(res, "Session details not found", 404);

    // Parse stored progress
    let progress = {};
    if (sessionDetail.userProgress) {
      progress =
        typeof sessionDetail.userProgress === "string"
          ? JSON.parse(sessionDetail.userProgress)
          : sessionDetail.userProgress;
    }

    // Check if user has progress saved
    const userProgress = progress[userId];
    if (!userProgress) {
      return ReE(res, "No score found for this user in this session", 404);
    }

    return ReS(
      res,
      {
        success: true,
        userId,
        courseId,
        coursePreviewId,
        day,
        sessionNumber,
        score: {
          correctMCQs: userProgress.correctMCQs,
          totalMCQs: userProgress.totalMCQs,
          eligibleForCaseStudy: userProgress.eligibleForCaseStudy,
          answers: userProgress.answers || {}, // include all saved answers
        },
      },
      200
    );
  } catch (error) {
    console.error("Get User MCQ Score Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getUserMCQScore = getUserMCQScore;

const getUserCaseStudyResult = async (req, res) => {
  try {
    const {
      courseId,
      coursePreviewId,
      day,
      sessionNumber,
      questionId,
      userId,
    } = req.params;

    if (!userId) return ReE(res, "userId is required", 400);

    // Fetch the user's latest case study result along with the question
    const result = await model.CaseStudyResult.findOne({
      where: {
        userId,
        courseId,
        coursePreviewId,
        day,
        sessionNumber,
        questionId,
      },
      include: [
        {
          model: model.QuestionModel,
          attributes: ["question"], // fetch only the question text
        },
      ],
      order: [["createdAt", "DESC"]], // fetch the latest submission
    });

    if (!result)
      return ReE(res, "No case study result found for this user", 404);

    return ReS(
      res,
      {
        success: true,
        data: {
          userId: result.userId,
          courseId: result.courseId,
          coursePreviewId: result.coursePreviewId,
          day: result.day,
          sessionNumber: result.sessionNumber,
          questionId: result.questionId,
          question: result.QuestionModel?.question || null,
          answer: result.answer,
          matchPercentage: result.matchPercentage,
          passed: result.passed,
        },
      },
      200
    );
  } catch (error) {
    console.error("Get User Case Study Result Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getUserCaseStudyResult = getUserCaseStudyResult;
