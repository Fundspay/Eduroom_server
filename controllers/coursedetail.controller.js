"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// ✅ Add CourseDetail with Questions for a specific day
var addCourseDetail = async (req, res) => {
    const {
        domainId,
          userId,
        courseId,
        coursePreviewId,
        day,
        title,
        description,
        youtubeLink,
        questions // Array of questions for this day
    } = req.body;

    // Basic validations
    if (!domainId) return ReE(res, "domainId is required", 400);
    if (!courseId) return ReE(res, "courseId is required", 400);
    if (!coursePreviewId) return ReE(res, "coursePreviewId is required", 400);
    if (!day) return ReE(res, "day is required", 400);
    if (!title) return ReE(res, "title is required", 400);

    try {
        // Check if course and course preview exist
        const course = await model.Course.findByPk(courseId);
        if (!course || course.isDeleted) return ReE(res, "Course not found", 404);

        const coursePreview = await model.CoursePreview.findByPk(coursePreviewId);
        if (!coursePreview || coursePreview.isDeleted) return ReE(res, "Course Preview not found", 404);

        // Create CourseDetail for the day
        const courseDetail = await model.CourseDetail.create({
            domainId,
            courseId,
            coursePreviewId,
            day,
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

        return ReS(res, {
            success: true,
            courseDetail,
            questions: questionRecords
        }, 201);

    } catch (error) {
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
            order: [["day", "ASC"]],
            include: [
                {
                    model: model.QuestionModel,
                    where: { isDeleted: false },
                    required: false, // include even if no questions
                    attributes: ["id","question","optionA","optionB","optionC","optionD","answer","keywords","caseStudy"]
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
// ✅ Evaluate MCQs for a specific course + course preview + day
const evaluateDayMCQ = async (req, res) => {
    try {
        const { courseId, coursePreviewId, day } = req.params;
        const { userId, answers } = req.body;

        if (!userId || !Array.isArray(answers)) {
            return ReE(res, "userId and answers are required", 400);
        }

        const dayDetail = await model.CourseDetail.findOne({
            where: { courseId, coursePreviewId, day, isDeleted: false },
            include: [
                {
                    model: model.QuestionModel,
                    where: { isDeleted: false },
                    required: false
                }
            ]
        });

        if (!dayDetail) return ReE(res, "Day details not found", 404);

        const mcqs = dayDetail.QuestionModels || [];

        if (mcqs.length === 0) return ReE(res, "No MCQs found for this day", 404);

        let correctCount = 0;
        let wrongCount = 0;
        const results = [];

        for (let ans of answers) {
            const mcq = mcqs.find(m => String(m.id) === String(ans.mcqId));
            if (!mcq) continue;

            const isCorrect = String(mcq.answer).toUpperCase() === String(ans.selectedOption).toUpperCase();
            if (isCorrect) correctCount++;
            else wrongCount++;

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

        // ✅ Save progress with string key
        const userProgress = dayDetail.userProgress || {};
        userProgress[String(userId)] = {
            correct: correctCount,
            total,
            eligibleForCaseStudy
        };
        await dayDetail.update({ userProgress });

        return ReS(res, {
            success: true,
            courseDetail: dayDetail,
            questions: mcqs,
            evaluation: {
                totalQuestions: total,
                correct: correctCount,
                wrong: wrongCount,
                score,
                eligibleForCaseStudy,
                results
            }
        }, 200);

    } catch (error) {
        console.error("Evaluate Day MCQ Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.evaluateDayMCQ = evaluateDayMCQ;

// ✅ Get all case studies for a specific day (if eligible)
const getCaseStudiesForDay = async (req, res) => {
    try {
        const { courseId, coursePreviewId, day } = req.params;
        const { userId } = req.query; // userId passed as query

        if (!userId) return ReE(res, "userId is required", 400);

        const dayDetail = await model.CourseDetail.findOne({
            where: { courseId, coursePreviewId, day, isDeleted: false },
            include: [
                {
                    model: model.QuestionModel,
                    where: { isDeleted: false, caseStudy: { [model.Sequelize.Op.ne]: null } },
                    required: false
                }
            ]
        });

        if (!dayDetail) return ReE(res, "Day details not found", 404);

        const userProgress = dayDetail.userProgress || {};
        const progress = userProgress[String(userId)]; // ✅ always string key

        if (!progress || !progress.eligibleForCaseStudy) {
            return ReS(res, {
                success: false,
                message: "You are not eligible to attempt the Case Studies yet. Complete all MCQs correctly first."
            }, 200);
        }

        const caseStudies = dayDetail.QuestionModels.map(q => ({
            questionId: q.id,
            caseStudy: q.caseStudy
        }));

        return ReS(res, {
            success: true,
            data: {
                courseId,
                coursePreviewId,
                day,
                caseStudies
            }
        }, 200);

    } catch (error) {
        console.error("Get Case Studies Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.getCaseStudiesForDay = getCaseStudiesForDay;

// ✅ Submit Case Study Answer & Evaluate
const submitCaseStudyAnswer = async (req, res) => {
    try {
        const { courseId, coursePreviewId, day, questionId } = req.params;
        const { userId, answer } = req.body;

        if (!userId || !answer) return ReE(res, "userId and answer is required", 400);

        // 1️⃣ Fetch QuestionModel with caseStudy
        const question = await model.QuestionModel.findOne({
            where: {
                id: questionId,
                courseId,
                coursePreviewId,
                day,
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

// ✅ Get daily status per user for a course + course preview
const getDailyStatusPerUser = async (req, res) => {
    try {
        const { userId, courseId, coursePreviewId } = req.params;

        if (!userId) return ReE(res, "userId is required", 400);

        // 1️⃣ Fetch all CourseDetail days for this course + preview
        const courseDays = await model.CourseDetail.findAll({
            where: { courseId, coursePreviewId, isDeleted: false },
            include: [
                {
                    model: model.QuestionModel,
                    where: { isDeleted: false },
                    required: false
                }
            ],
            order: [["day", "ASC"]]
        });

        if (!courseDays || courseDays.length === 0) return ReE(res, "No course days found", 404);

        const dailyStatus = await Promise.all(
            courseDays.map(async (day) => {
                const questions = day.QuestionModels || [];

                // MCQs for this day
                const mcqs = questions.filter(q => q.optionA && q.optionB && q.optionC && q.optionD);
                const totalMCQs = mcqs.length;

                // Evaluate user MCQs based on userProgress stored in CourseDetail
                const userProgress = day.userProgress || {};
                const progress = userProgress[userId] || {};
                const correctMCQs = progress.correct || 0;
                const eligibleForCaseStudy = totalMCQs > 0 ? (correctMCQs === totalMCQs) : false;

                // Case Study for this day (questions with caseStudy)
                const caseStudyQuestions = questions.filter(q => q.caseStudy);
                const caseStudyIds = caseStudyQuestions.map(q => q.id);

                // Check if user has submitted case study results
                const caseStudyResults = await model.CaseStudyResult.findAll({
                    where: {
                        userId,
                        courseId,
                        coursePreviewId,
                        day,
                        questionId: caseStudyIds
                    }
                });

                const caseStudyCompleted = caseStudyResults.length > 0;
                const caseStudyPassed = caseStudyResults.some(r => r.passed);

                return {
                    dayNumber: day.day,
                    title: day.title,
                    totalMCQs,
                    correctMCQs,
                    eligibleForCaseStudy,
                    caseStudyCompleted,
                    caseStudyPassed
                };
            })
        );

        return ReS(res, { success: true, data: dailyStatus }, 200);

    } catch (error) {
        console.error("Get Daily Status Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.getDailyStatusPerUser = getDailyStatusPerUser;

// ✅ Get overall course progress per user
const getOverallCourseStatus = async (req, res) => {
    try {
        const { userId, courseId, coursePreviewId } = req.params;

        if (!userId) return ReE(res, "userId is required", 400);

        // Fetch all CourseDetail days for this course + preview
        const courseDays = await model.CourseDetail.findAll({
            where: { courseId, coursePreviewId, isDeleted: false },
            include: [
                {
                    model: model.QuestionModel,
                    where: { isDeleted: false },
                    required: false
                }
            ]
        });

        if (!courseDays || courseDays.length === 0) return ReE(res, "No course days found", 404);

        let completedDays = 0;

        for (const day of courseDays) {
            const questions = day.QuestionModels || [];

            // MCQs for this day
            const mcqs = questions.filter(q => q.optionA && q.optionB && q.optionC && q.optionD);
            const totalMCQs = mcqs.length;

            // User MCQ progress stored in CourseDetail
            const userProgress = day.userProgress || {};
            const progress = userProgress[userId] || {};
            const correctMCQs = progress.correct || 0;
            const eligibleForCaseStudy = totalMCQs > 0 ? (correctMCQs === totalMCQs) : false;

            // Case Studies
            const caseStudyQuestions = questions.filter(q => q.caseStudy);
            const caseStudyIds = caseStudyQuestions.map(q => q.id);

            const caseStudyResults = await model.CaseStudyResult.findAll({
                where: {
                    userId,
                    courseId,
                    coursePreviewId,
                    day,
                    questionId: caseStudyIds
                }
            });

            const caseStudyPassed = caseStudyResults.some(r => r.passed);

            // Check if day is fully completed
            const dayCompleted = (eligibleForCaseStudy && (caseStudyQuestions.length === 0 || caseStudyPassed));
            if (dayCompleted) completedDays++;
        }

        const totalDays = courseDays.length;
        const overallProgressPercent = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

        return ReS(res, {
            success: true,
            data: {
                totalDays,
                completedDays,
                overallProgressPercent
            }
        }, 200);

    } catch (error) {
        console.error("Get Overall Course Status Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.getOverallCourseStatus = getOverallCourseStatus;

// ✅ Get business target for a user per course
const getBusinessTarget = async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    // 1️⃣ Fetch user
    const user = await model.User.findByPk(userId);
    if (!user) return ReE(res, "User not found", 404);

    // 2️⃣ Fetch course
    const course = await model.Course.findByPk(courseId);
    if (!course) return ReE(res, "Course not found", 404);

    // 3️⃣ Check if user has referral code
    const referralCode = user.referralCode;
    let referralCount = 0;

    if (referralCode) {
      // Call external Lambda or API to get number of referrals
      const lambdaResponse = await axios.get(
        `https://your-lambda-endpoint.com/getReferrals?code=${referralCode}`
      );

      referralCount = lambdaResponse.data?.totalReferrals || 0;
    }

    // 4️⃣ Calculate business target (example: each referral = 10 units)
    const businessTarget = referralCount * 10;

    // 5️⃣ Save or update UserCourse
    let userCourse = await model.UserCourse.findOne({
      where: { userId, courseId }
    });

    if (!userCourse) {
      userCourse = await model.UserCourse.create({
        userId,
        courseId,
        businessTarget
      });
    } else {
      userCourse.businessTarget = businessTarget;
      await userCourse.save();
    }

    // 6️⃣ Return response
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






