"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const axios = require('axios');


// ✅ Add CourseDetail with Questions for a specific day (multiple sessions)
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

            for (const session of sessions) {
                const {
                    sessionNumber,
                    title,
                    description,
                    youtubeLink,
                    questions,
                    duration,
                    sessionDuration,
                    heading
                } = session;

                if (!sessionNumber) return ReE(res, "sessionNumber is required for each session", 400);
                if (!title) return ReE(res, "title is required for each session", 400);

                // ✅ Add new fields
                const courseDetail = await model.CourseDetail.create({
                    domainId,
                    courseId,
                    coursePreviewId,
                    day,
                    sessionNumber,
                    userId,
                    title,
                    heading: heading || null,
                    sessionDuration: sessionDuration || null,
                    duration: duration || null,
                    description: description || null,
                    youtubeLink: youtubeLink || null
                });

                // Add MCQs
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

        return ReS(res, { success: true, days: createdDays }, 201);

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
        const coursePreview = await model.CoursePreview.findByPk(coursePreviewId);
        if (!coursePreview || coursePreview.isDeleted) return ReE(res, "Course Preview not found", 404);

        const courseDetails = await model.CourseDetail.findAll({
            where: { coursePreviewId, isDeleted: false },
            order: [["day", "ASC"], ["sessionNumber", "ASC"]],
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
                "createdAt",
                "updatedAt"
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
                        "sessionNumber"
                    ]
                },
                {
                    model: model.Course,
                    attributes: ["id", "name"] // Include course name
                },
                {
                    model: model.Domain,
                    attributes: ["id", "name"] // Include domain name
                }
            ]
        });

        return ReS(res, { success: true, data: courseDetails }, 200);
    } catch (error) {
        console.error("Fetch Course Details Error:", error);
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

        // Fetch session details with MCQs
        const sessionDetail = await model.CourseDetail.findOne({
            where: { courseId, coursePreviewId, day, sessionNumber, isDeleted: false },
            include: [{ model: model.QuestionModel, where: { isDeleted: false }, required: false }]
        });

        if (!sessionDetail) return ReE(res, "Session details not found", 404);

        const mcqs = sessionDetail.QuestionModels || [];
        if (mcqs.length === 0) return ReE(res, "No MCQs found for this session", 404);

        let correctCount = 0;
        const results = [];

        // Evaluate each answer
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

        // Normalize existing userProgress
        let progress = {};
        if (sessionDetail.userProgress) {
            progress = typeof sessionDetail.userProgress === "string" ? JSON.parse(sessionDetail.userProgress) : sessionDetail.userProgress;
        }

        // Set current user's progress
        progress[userId] = { correctMCQs: correctCount, totalMCQs: total, eligibleForCaseStudy: correctCount === total };

        // Update DB
        await model.CourseDetail.update(
            { userProgress: progress },
            { where: { id: sessionDetail.id } }
        );

        return ReS(res, {
            success: true,
            courseDetail: sessionDetail,
            questions: mcqs,
            evaluation: {
                totalQuestions: total,
                correct: correctCount,
                wrong: total - correctCount,
                score,
                eligibleForCaseStudy: correctCount === total,
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

        const caseStudyQuestion = (sessionDetail.QuestionModels || []).find(q => q.caseStudy);
        if (!caseStudyQuestion) {
            return ReS(res, { success: false, message: "No Case Study available for this session." }, 200);
        }

        return ReS(res, {
            success: true,
            data: {
                userId,
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

        // Fetch case study question
        const question = await model.QuestionModel.findOne({
            where: {
                id: questionId,
                courseId,
                coursePreviewId,
                day,
                sessionNumber,
                isDeleted: false,
                caseStudy: { [model.Sequelize.Op.ne]: null }
            }
        });

        if (!question) return ReE(res, "Case Study not found", 404);

        // Evaluate answer using keywords
        const keywords = question.keywords ? question.keywords.split(",") : [];
        const userAnswerLower = answer.toLowerCase();
        let matchedCount = 0;

        keywords.forEach(kw => {
            if (userAnswerLower.includes(kw.trim().toLowerCase())) matchedCount++;
        });

        const matchPercentage = (matchedCount / (keywords.length || 1)) * 100;
        const passed = matchPercentage >= 35;

        // Save result
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
                userId,
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

// ✅ Session-wise status for a user
const getSessionStatusPerUser = async (req, res) => {
    try {
        const { courseId, coursePreviewId, userId } = req.params;
        if (!userId) return ReE(res, "userId is required", 400);

        const sessions = await model.CourseDetail.findAll({
            where: { courseId, coursePreviewId, isDeleted: false },
            order: [["day", "ASC"], ["sessionNumber", "ASC"]]
        });

        if (!sessions.length) return ReE(res, "No sessions found for this course", 404);

        const sessionStatus = sessions.map(session => {
            const progress = session.userProgress?.[userId];
            return {
                day: session.day,
                sessionNumber: session.sessionNumber,
                title: session.title,
                attempted: !!progress,
                correctMCQs: progress?.correctMCQs || 0,
                totalMCQs: progress?.totalMCQs || 0
            };
        });

        return ReS(res, {
            success: true,
            totalSessions: sessions.length,
            sessionStatus
        }, 200);

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
            order: [["day", "ASC"], ["sessionNumber", "ASC"]]
        });

        if (!sessions.length) return ReE(res, "No sessions found for this course", 404);

        let completedSessions = 0;
        const daysMap = {};

        sessions.forEach(session => {
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
                totalMCQs: progress?.totalMCQs || 0
            });
        });

        const overallStatus = {
            totalDays: Object.keys(daysMap).length,
            totalSessions: sessions.length,
            completedSessions,
            completionRate: ((completedSessions / sessions.length) * 100).toFixed(2) + "%",
            days: daysMap
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

        const sessions = await model.CourseDetail.findAll({
            where: { courseId, coursePreviewId, isDeleted: false },
            order: [["day", "ASC"], ["sessionNumber", "ASC"]]
        });

        if (!sessions.length) return ReE(res, "No sessions found for this course", 404);

        const daysMap = {};

        sessions.forEach(session => {
            const progress = session.userProgress?.[userId];
            const attempted = !!progress;

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
                totalMCQs: progress?.totalMCQs || 0
            });
        });

        const dailyStatus = Object.keys(daysMap).map(dayKey => {
            const d = daysMap[dayKey];
            return {
                day: Number(dayKey),
                totalSessions: d.total,
                completedSessions: d.completed,
                fullyCompleted: d.completed === d.total,
                sessions: d.sessions
            };
        });

        return ReS(res, { success: true, dailyStatus }, 200);

    } catch (error) {
        console.error("Get Daily Status Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.getDailyStatusPerUser = getDailyStatusPerUser;


const getBusinessTarget = async (req, res) => {
    try {
        let { userId, courseId } = req.params;

        // Convert IDs to integers
        userId = parseInt(userId, 10);
        courseId = parseInt(courseId, 10);

        if (isNaN(userId) || isNaN(courseId)) return ReE(res, "Invalid userId or courseId", 400);

        // 1️⃣ Fetch user
        const user = await model.User.findByPk(userId);
        if (!user) return ReE(res, "User not found", 404);

        // 2️⃣ Fetch course
        const course = await model.Course.findByPk(courseId);
        if (!course) return ReE(res, "Course not found", 404);

        const businessTarget = course.businessTarget || 0;

        // 3️⃣ Fetch referral count from external API
        let referralCount = 0;
        if (user.referralCode) {
            const apiUrl = `https://lc8j8r2xza.execute-api.ap-south-1.amazonaws.com/prod/auth/getReferralCount?referral_code=${user.referralCode}`;
            const apiResponse = await axios.get(apiUrl);
            referralCount = Number(apiResponse.data?.referral_count) || 0;
        }

        // 4️⃣ Calculate achieved units (assuming 1 referral = 10 units)
        const achievedCount = referralCount * 10;
        const remaining = Math.max(businessTarget - achievedCount, 0);

        // 5️⃣ Return response
        return ReS(res, {
            success: true,
            data: {
                userId,
                courseId,
                businessTarget,
                achievedCount,
                remaining
            }
        }, 200);

    } catch (error) {
        console.error("Get Business Target Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.getBusinessTarget = getBusinessTarget;

const getCourseStatus = async (req, res) => {
    try {
        const { courseId, coursePreviewId, userId } = req.params;

        if (!userId) {
            return ReE(res, "userId is required", 400);
        }

        // 1. Fetch all sessions of this course
        const sessions = await CourseDetail.findAll({
            where: { courseId, coursePreviewId, isDeleted: false },
            include: [
                {
                    model: QuestionModel,
                    where: { isDeleted: false },
                    required: false
                }
            ],
            order: [["day", "ASC"], ["sessionNumber", "ASC"]]
        });

        if (!sessions || sessions.length === 0) {
            return ReE(res, "No course sessions found", 404);
        }

        // Counters
        const totalSessions = sessions.length;
        let completedSessions = 0;

        // 2. Build structured response
        const status = sessions.map(session => {
            const progress = session.userProgress || {};
            const userProg = progress[userId] || {
                correctMCQs: 0,
                totalMCQs: session.QuestionModels.length
            };

            // ✅ Session is completed if all MCQs attempted (correct or not)
            const isCompleted = userProg.correctMCQs === userProg.totalMCQs && userProg.totalMCQs > 0;
            if (isCompleted) completedSessions++;

            return {
                day: session.day,
                sessionNumber: session.sessionNumber,
                title: session.title,
                description: session.description,
                youtubeLink: session.youtubeLink,
                mcqProgress: userProg,
                status: isCompleted ? "Completed" : "In Progress"
            };
        });

        const remainingSessions = totalSessions - completedSessions;
        const overallStatus = completedSessions === totalSessions ? "Completed" : "In Progress";

        return ReS(res, {
            success: true,
            summary: {
                totalSessions,
                completedSessions,
                remainingSessions,
                overallStatus
            },
            courseStatus: status
        }, 200);
    } catch (err) {
        console.error("Get Course Status Error:", err);
        return ReE(res, err.message, 500);
    }
};

module.exports.getCourseStatus = getCourseStatus;
