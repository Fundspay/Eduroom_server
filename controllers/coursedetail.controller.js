"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const axios = require('axios');


// ✅ Add CourseDetail with Questions for a specific day (multiple sessions)
// ✅ Add CourseDetail with Questions for multiple days and sessions
var addCourseDetail = async (req, res) => {
    const {
        domainId,
        userId,
        courseId,
        coursePreviewId,
        days // Array of days, each containing sessions
    } = req.body;

    // Basic validations
    if (!domainId) return ReE(res, "domainId is required", 400);
    if (!courseId) return ReE(res, "courseId is required", 400);
    if (!coursePreviewId) return ReE(res, "coursePreviewId is required", 400);
    if (!Array.isArray(days) || days.length === 0) return ReE(res, "days are required", 400);

    try {
        // Check if course and course preview exist
        const course = await model.Course.findByPk(courseId);
        if (!course || course.isDeleted) return ReE(res, "Course not found", 404);

        const coursePreview = await model.CoursePreview.findByPk(coursePreviewId);
        if (!coursePreview || coursePreview.isDeleted) return ReE(res, "Course Preview not found", 404);

        const createdDays = [];

        // Loop through each day
        for (const dayObj of days) {
            const { day, sessions } = dayObj;

            if (!day) return ReE(res, "day is required for each day object", 400);
            if (!Array.isArray(sessions) || sessions.length === 0) return ReE(res, `sessions are required for day ${day}`, 400);

            const createdSessions = [];

            // Loop through each session
            for (const session of sessions) {
                const { sessionNumber, title, description, youtubeLink, questions } = session;

                if (!sessionNumber) return ReE(res, "sessionNumber is required for each session", 400);
                if (!title) return ReE(res, "title is required for each session", 400);

                // Create CourseDetail for this session
                const courseDetail = await model.CourseDetail.create({
                    domainId,
                    courseId,
                    coursePreviewId,
                    day,
                    sessionNumber,
                    userId,
                    title,
                    description: description || null,
                    youtubeLink: youtubeLink || null
                });

                // Add MCQs if provided
                let questionRecords = [];
                if (Array.isArray(questions) && questions.length > 0) {
                    questionRecords = questions.map(q => ({
                        courseDetailId: courseDetail.id,
                        domainId,
                        courseId,
                        coursePreviewId,
                        day,
                        sessionNumber,
                        question: q.question,
                        optionA: q.optionA,
                        optionB: q.optionB,
                        optionC: q.optionC,
                        optionD: q.optionD,
                        answer: q.answer,
                        keywords: q.keywords || null,
                        caseStudy: q.caseStudy || null
                    }));

                    await model.QuestionModel.bulkCreate(questionRecords);
                }

                createdSessions.push({
                    courseDetail,
                    questions: questionRecords
                });
            }

            createdDays.push({
                day,
                sessions: createdSessions
            });
        }

        return ReS(res, {
            success: true,
            days: createdDays
        }, 201);

    } catch (error) {
        console.error("Add Course Details Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.addCourseDetail = addCourseDetail;


// ✅ Fetch all CourseDetails by coursePreviewId (with MCQs)
var fetchCourseDetailsByPreview = async (req, res) => {
    const { coursePreviewId } = req.params;
    if (!coursePreviewId) return ReE(res, "coursePreviewId is required", 400);

    try {
        // Ensure the course preview exists
        const coursePreview = await model.CoursePreview.findByPk(coursePreviewId);
        if (!coursePreview || coursePreview.isDeleted) return ReE(res, "Course Preview not found", 404);

        // Fetch all course details for this preview, include questions
        const courseDetails = await model.CourseDetail.findAll({
            where: { coursePreviewId, isDeleted: false },
            order: [
                ["day", "ASC"],
                ["sessionNumber", "ASC"] // 👈 Order sessions inside each day
            ],
            include: [
                {
                    model: model.QuestionModel,
                    where: { isDeleted: false },
                    required: false, // include even if no questions
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
                        "sessionNumber" // 👈 keep session info at question level too
                    ]
                }
            ]
        });

        return ReS(res, { success: true, data: courseDetails }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};

module.exports.fetchCourseDetailsByPreview = fetchCourseDetailsByPreview;

// ✅ Evaluate MCQs for a specific course + course preview + day

const evaluateSessionMCQ = async (req, res) => {
    try {
        const { courseId, coursePreviewId, day, sessionNumber } = req.params;
        const { userId, answers } = req.body;

        if (!userId || !Array.isArray(answers)) {
            return ReE(res, "userId and answers are required", 400);
        }

        // ✅ Convert params to integers to match DB
        const courseIdInt = parseInt(courseId);
        const coursePreviewIdInt = parseInt(coursePreviewId);
        const dayInt = parseInt(day);
        const sessionNumberInt = parseInt(sessionNumber);

        // ✅ Find the session details
        const sessionDetail = await model.CourseDetail.findOne({
            where: {
                courseId: courseIdInt,
                coursePreviewId: coursePreviewIdInt,
                day: dayInt,
                sessionNumber: sessionNumberInt,
                isDeleted: false
            },
            include: [
                {
                    model: model.QuestionModel,
                    where: { isDeleted: false },
                    required: false
                }
            ]
        });

        if (!sessionDetail) return ReE(res, "Session details not found", 404);

        const mcqs = sessionDetail.QuestionModels || [];
        if (mcqs.length === 0) return ReE(res, "No MCQs found for this session", 404);

        let correctCount = 0;
        const results = [];

        // ✅ Evaluate each answer
        for (let ans of answers) {
            const mcq = mcqs.find(m => String(m.id) === String(ans.mcqId));
            if (!mcq) continue;

            const isCorrect = String(mcq.answer).toUpperCase() === String(ans.selectedOption).toUpperCase();
            if (isCorrect) correctCount++;

            results.push({
                mcqId: mcq.id,
                question: mcq.question,
                selectedOption: ans.selectedOption,
                isCorrect,
                correctAnswer: mcq.answer,
                keywords: mcq.keywords || null,
                caseStudy: mcq.caseStudy || null
            });
        }

        const total = mcqs.length;
        const score = `${correctCount}/${total}`;
        const eligibleForCaseStudy = correctCount === total;

        // ✅ Update session-level userProgress
        const userProgress = { eligibleForCaseStudy };
        await sessionDetail.update({ userProgress });

        return ReS(res, {
            success: true,
            courseDetail: sessionDetail,
            questions: mcqs,
            evaluation: {
                totalQuestions: total,
                correct: correctCount,
                wrong: total - correctCount,
                score,
                eligibleForCaseStudy,
                results
            }
        }, 200);

    } catch (error) {
        console.error("Evaluate Session MCQ Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.evaluateSessionMCQ = evaluateSessionMCQ;

const getCaseStudyForSession = async (req, res) => {
    try {
        const { courseId, coursePreviewId, day, sessionNumber } = req.params;
        const { userId } = req.query;

        if (!userId) return ReE(res, "userId is required", 400);

        const sessionDetail = await model.CourseDetail.findOne({
            where: { courseId, coursePreviewId, day, sessionNumber, isDeleted: false },
            include: [{ model: model.QuestionModel, where: { isDeleted: false }, required: false }]
        });

        if (!sessionDetail) return ReE(res, "Session details not found", 404);

        const progress = sessionDetail.userProgress?.eligibleForCaseStudy;
        console.log("sessionDetail.userProgress:", sessionDetail.userProgress);
        console.log("Eligibility for user:", progress);

        if (!progress) {
            return ReS(res, {
                success: false,
                message: "You are not eligible to attempt the Case Study yet. Complete all MCQs correctly first."
            }, 200);
        }

        const caseStudyQuestion = (sessionDetail.QuestionModels || []).find(q => q.caseStudy);
        if (!caseStudyQuestion) {
            return ReS(res, { success: false, message: "No Case Study available for this session." }, 200);
        }

        return ReS(res, {
            success: true,
            data: {
                courseId,
                coursePreviewId,
                day,
                sessionNumber,
                caseStudy: { questionId: caseStudyQuestion.id, caseStudy: caseStudyQuestion.caseStudy }
            }
        }, 200);

    } catch (error) {
        console.error("Get Case Study Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.getCaseStudyForSession = getCaseStudyForSession;

const submitCaseStudyAnswer = async (req, res) => {
    try {
        const { courseId, coursePreviewId, day, sessionNumber, questionId } = req.params;
        const { userId, answer } = req.body;

        if (!userId || !answer) return ReE(res, "userId and answer are required", 400);

        // 1️⃣ Fetch QuestionModel with caseStudy (session-specific)
        const question = await model.QuestionModel.findOne({
            where: {
                id: questionId,
                courseId,
                coursePreviewId,
                day,
                sessionNumber,
                isDeleted: false,
                caseStudy: { [model.Sequelize.Op.ne]: null } // must have caseStudy
            }
        });

        if (!question) return ReE(res, "Case Study not found", 404);

        // 2️⃣ Evaluate answer against keywords
        const keywords = question.keywords ? question.keywords.split(",") : [];
        if (keywords.length === 0) return ReE(res, "No keywords found for evaluation", 500);

        const userAnswerLower = answer.toLowerCase();
        let matchedCount = 0;

        keywords.forEach(kw => {
            if (userAnswerLower.includes(kw.trim().toLowerCase())) matchedCount++;
        });

        const matchPercentage = (matchedCount / keywords.length) * 100;
        const passed = matchPercentage >= 35; // pass threshold

        // 3️⃣ Save user result in CaseStudyResult table
        await model.CaseStudyResult.create({
            userId,
            courseId,
            coursePreviewId,
            day,
            sessionNumber,
            questionId,
            answer,
            matchPercentage,
            passed
        });

        return ReS(res, {
            success: true,
            data: {
                courseId,
                coursePreviewId,
                day,
                sessionNumber,
                questionId,
                matchPercentage,
                passed,
                message: passed ? "You have passed this Case Study" : "You did not pass. Try again."
            }
        }, 200);

    } catch (error) {
        console.error("Submit Case Study Answer Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.submitCaseStudyAnswer = submitCaseStudyAnswer;

// ✅ Get session-wise status per user for a course + course preview
const getSessionStatusPerUser = async (req, res) => {
    try {
        const { userId, courseId, coursePreviewId } = req.params;

        if (!userId) return ReE(res, "userId is required", 400);

        // 1️⃣ Fetch all CourseDetail sessions for this course + preview
        const courseSessions = await model.CourseDetail.findAll({
            where: { courseId, coursePreviewId, isDeleted: false },
            include: [
                {
                    model: model.QuestionModel,
                    where: { isDeleted: false },
                    required: false
                }
            ],
            order: [["day", "ASC"], ["sessionNumber", "ASC"]]
        });

        if (!courseSessions || courseSessions.length === 0) {
            return ReE(res, "No course sessions found", 404);
        }

        const sessionStatus = await Promise.all(
            courseSessions.map(async (session) => {
                const questions = session.QuestionModels || [];

                // MCQs for this session
                const mcqs = questions.filter(q => q.optionA && q.optionB && q.optionC && q.optionD);
                const totalMCQs = mcqs.length;

                // ✅ Evaluate user MCQ progress stored in CourseDetail.userProgress
                const userProgress = session.userProgress || {};
                const progress = userProgress[userId] || {};
                const correctMCQs = progress.correct || 0;
                const eligibleForCaseStudy = totalMCQs > 0 ? (correctMCQs === totalMCQs) : false;

                // ✅ Case Study for this session
                const caseStudyQuestions = questions.filter(q => q.caseStudy);
                const caseStudyIds = caseStudyQuestions.map(q => q.id);

                // ✅ Check if user has submitted case study results
                const caseStudyResults = await model.CaseStudyResult.findAll({
                    where: {
                        userId,
                        courseId,
                        coursePreviewId,
                        day: session.day,
                        sessionNumber: session.sessionNumber,
                        questionId: caseStudyIds
                    }
                });

                const caseStudyCompleted = caseStudyResults.length > 0;
                const caseStudyPassed = caseStudyResults.some(r => r.passed);

                return {
                    dayNumber: session.day,
                    sessionNumber: session.sessionNumber,
                    title: session.title,
                    totalMCQs,
                    correctMCQs,
                    eligibleForCaseStudy,
                    caseStudyCompleted,
                    caseStudyPassed
                };
            })
        );

        return ReS(res, { success: true, data: sessionStatus }, 200);

    } catch (error) {
        console.error("Get Session Status Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.getSessionStatusPerUser = getSessionStatusPerUser;

// ✅ Get overall course progress per user
const getOverallCourseStatus = async (req, res) => {
    try {
        const { userId, courseId, coursePreviewId } = req.params;

        if (!userId) return ReE(res, "userId is required", 400);

        // 1️⃣ Fetch all CourseDetail sessions for this course + preview
        const courseSessions = await model.CourseDetail.findAll({
            where: { courseId, coursePreviewId, isDeleted: false },
            include: [
                {
                    model: model.QuestionModel,
                    where: { isDeleted: false },
                    required: false
                }
            ],
            order: [["day", "ASC"], ["sessionNumber", "ASC"]]
        });

        if (!courseSessions || courseSessions.length === 0) {
            return ReE(res, "No course sessions found", 404);
        }

        let completedSessions = 0;

        for (const session of courseSessions) {
            const questions = session.QuestionModels || [];

            // MCQs for this session
            const mcqs = questions.filter(q => q.optionA && q.optionB && q.optionC && q.optionD);
            const totalMCQs = mcqs.length;

            // ✅ User MCQ progress stored in CourseDetail
            const userProgress = session.userProgress || {};
            const progress = userProgress[userId] || {};
            const correctMCQs = progress.correct || 0;
            const eligibleForCaseStudy = totalMCQs > 0 ? (correctMCQs === totalMCQs) : false;

            // ✅ Case Studies for this session
            const caseStudyQuestions = questions.filter(q => q.caseStudy);
            const caseStudyIds = caseStudyQuestions.map(q => q.id);

            const caseStudyResults = await model.CaseStudyResult.findAll({
                where: {
                    userId,
                    courseId,
                    coursePreviewId,
                    day: session.day,
                    sessionNumber: session.sessionNumber,
                    questionId: caseStudyIds
                }
            });

            const caseStudyPassed = caseStudyResults.some(r => r.passed);

            // ✅ A session is completed if:
            // - All MCQs are correct
            // - Case Study (if any) is passed
            const sessionCompleted = (eligibleForCaseStudy && (caseStudyQuestions.length === 0 || caseStudyPassed));

            if (sessionCompleted) completedSessions++;
        }

        const totalSessions = courseSessions.length;
        const overallProgressPercent = totalSessions > 0
            ? Math.round((completedSessions / totalSessions) * 100)
            : 0;

        return ReS(res, {
            success: true,
            data: {
                totalSessions,
                completedSessions,
                overallProgressPercent
            }
        }, 200);

    } catch (error) {
        console.error("Get Overall Course Status Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.getOverallCourseStatus = getOverallCourseStatus;


const getBusinessTarget = async (req, res) => {
  try {
    let { userId, courseId } = req.params;

    // Convert IDs to numbers (safety)
    userId = parseInt(userId, 10);
    courseId = parseInt(courseId, 10);

    if (isNaN(userId) || isNaN(courseId)) return ReE(res, "Invalid userId or courseId", 400);

    // Fetch user
    const user = await model.User.findByPk(userId);
    if (!user) return ReE(res, "User not found", 404);

    // Get referral count from external API
    const referralCode = user.referralCode;
    let referralCount = 0;

    if (referralCode) {
      const apiUrl = `https://lc8j8r2xza.execute-api.ap-south-1.amazonaws.com/prod/auth/getReferralCount?referral_code=${referralCode}`;
      const apiResponse = await axios.get(apiUrl);
      referralCount = Number(apiResponse.data?.referral_count) || 0;
    }

    // Calculate business target (1 referral = 10 units)
    const businessTarget = referralCount * 10;

    // Update per-course in user.businessTargets JSON
    const userBusinessTargets = user.businessTargets || {};
    userBusinessTargets[courseId] = businessTarget;

    await user.update({ businessTargets: userBusinessTargets });

    // Return response
    return ReS(res, {
      success: true,
      data: {
        userId,
        courseId,
        referralCode,
        referralCount,
        businessTarget
      }
    }, 200);

  } catch (error) {
    console.error("Get Business Target Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getBusinessTarget = getBusinessTarget;