"use strict";
const { Op } = require("sequelize");
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { sendMail } = require("../middleware/mailer.middleware");
const { SelectedCourseDetail, SelectedQuestionModel, SelectionDomain, SelectedCaseStudyResult, Users, sequelize } = require("../models");


// 🔹 Create or Update Selected Course Detail and its Questions
const addOrUpdateSelectedCourseDetail = async (req, res) => {
  const { selectedDomainId, userId, title, description, duration, heading, youtubeLink, questions } = req.body;

  if (!selectedDomainId) return ReE(res, "selectedDomainId is required", 400);
  if (!title) return ReE(res, "title is required", 400);

  const transaction = await sequelize.transaction();

  try {
    // 🔹 Check if course detail already exists
    let courseDetail = await SelectedCourseDetail.findOne({
      where: { selectedDomainId },
      transaction,
    });

    if (!courseDetail) {
      // 🔹 Create new SelectedCourseDetail
      courseDetail = await SelectedCourseDetail.create(
        {
          selectedDomainId,
          userId: userId ?? null,
          title,
          description: description ?? null,
          duration: duration ?? null,
          heading: heading ?? null,
          youtubeLink: youtubeLink ?? null,
        },
        { transaction }
      );
    } else {
      // 🔹 Update existing record
      await courseDetail.update(
        {
          title,
          description: description ?? null,
          duration: duration ?? null,
          heading: heading ?? null,
          youtubeLink: youtubeLink ?? null,
        },
        { transaction }
      );
    }

    // 🔹 Handle related questions (if any)
    if (Array.isArray(questions)) {
      const existingQuestions = await SelectedQuestionModel.findAll({
        where: { selectedDomainId },
        transaction,
      });

      const existingMap = {};
      existingQuestions.forEach((q) => (existingMap[q.id] = q));
      const incomingIds = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qId = Number(q.id);

        if (qId && existingMap[qId]) {
          // 🔹 Update existing question
          await existingMap[qId].update(
            {
              question: q.question,
              optionA: q.optionA,
              optionB: q.optionB,
              optionC: q.optionC,
              optionD: q.optionD,
              answer: q.answer,
              keywords: q.keywords ?? null,
              caseStudy: q.caseStudy ?? null,
            },
            { transaction }
          );
          incomingIds.push(qId);
        } else {
          // 🔹 Create new question
          const newQ = await SelectedQuestionModel.create(
            {
              selectedDomainId,
              userId,
              question: q.question,
              optionA: q.optionA,
              optionB: q.optionB,
              optionC: q.optionC,
              optionD: q.optionD,
              answer: q.answer,
              keywords: q.keywords ?? null,
              caseStudy: q.caseStudy ?? null,
            },
            { transaction }
          );
          incomingIds.push(newQ.id);
        }
      }

      // 🔹 Delete removed questions
      const toDelete = existingQuestions.filter((q) => !incomingIds.includes(q.id));
      if (toDelete.length > 0) {
        const deleteIds = toDelete.map((q) => q.id);
        await SelectedQuestionModel.destroy({
          where: { id: deleteIds },
          transaction,
        });
      }
    }

    await transaction.commit();
    return ReS(res, { success: true, courseDetail }, 201);
  } catch (error) {
    await transaction.rollback();
    console.error("Add/Update SelectedCourseDetail Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.addOrUpdateSelectedCourseDetail = addOrUpdateSelectedCourseDetail;

// 🔹 Delete SelectedCourseDetail
const deleteSelectedCourseDetail = async (req, res) => {
  const { selectedCourseDetailId } = req.params;

  if (!selectedCourseDetailId) {
    return ReE(res, "selectedCourseDetailId is required", 400);
  }

  const transaction = await sequelize.transaction();
  try {
    // 🔹 Find the SelectedCourseDetail by ID
    const selectedCourseDetail = await SelectedCourseDetail.findByPk(selectedCourseDetailId, {
      transaction,
    });

    if (!selectedCourseDetail) {
      await transaction.rollback();
      return ReE(res, "SelectedCourseDetail not found", 404);
    }

    // 🔹 Delete all questions linked to the same selectedDomainId
    await SelectedQuestionModel.destroy({
      where: { selectedDomainId: selectedCourseDetail.selectedDomainId },
      transaction,
    });

    // 🔹 Delete the SelectedCourseDetail record itself
    await selectedCourseDetail.destroy({ transaction });

    await transaction.commit();
    return ReS(
      res,
      {
        success: true,
        message: "SelectedCourseDetail and associated questions deleted successfully",
      },
      200
    );
  } catch (error) {
    await transaction.rollback();
    console.error("❌ Delete SelectedCourseDetail Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.deleteSelectedCourseDetail = deleteSelectedCourseDetail;

const getSelectedCourseDetail = async (req, res) => {
  const { selectedDomainId } = req.params;

  if (!selectedDomainId) return ReE(res, "selectedDomainId is required", 400);

  try {
    // 🔹 Fetch the main course detail
    const courseDetail = await SelectedCourseDetail.findOne({
      where: { selectedDomainId },
    });

    if (!courseDetail) return ReE(res, "Selected course detail not found", 404);

    // 🔹 Fetch related questions
    const questions = await SelectedQuestionModel.findAll({
      where: { selectedDomainId },
      order: [["id", "ASC"]],
    });

    // 🔹 Combine both
    const result = {
      id: courseDetail.id,
      selectedDomainId: courseDetail.selectedDomainId,
      userId: courseDetail.userId,
      title: courseDetail.title,
      description: courseDetail.description,
      duration: courseDetail.duration,
      heading: courseDetail.heading,
      youtubeLink: courseDetail.youtubeLink,
      questions: questions.map((q) => ({
        id: q.id,
        question: q.question,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        answer: q.answer,
        keywords: q.keywords,
        caseStudy: q.caseStudy,
      })),
    };

    return ReS(res, { success: true, data: result }, 200);
  } catch (error) {
    console.error("Get SelectedCourseDetail Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getSelectedCourseDetail = getSelectedCourseDetail;

// ===============================
// 🧩 Evaluate MCQ
// ==============================

const evaluateSelectedMCQ = async (req, res) => {
  try {
    const { selectedDomainId } = req.params;
    const { userId, answers } = req.body;

    if (!selectedDomainId) return ReE(res, "selectedDomainId is required", 400);
    if (!userId) return ReE(res, "userId is required", 400);
    if (!Array.isArray(answers)) return ReE(res, "answers must be an array", 400);

    // 🔹 Fetch course + MCQs
    const courseDetail = await SelectedCourseDetail.findOne({
      where: { selectedDomainId },
      include: [{ model: SelectedQuestionModel, required: false }],
    });

    if (!courseDetail) return ReE(res, "Selected course detail not found", 404);

    const mcqs = courseDetail.SelectedQuestionModels || [];
    if (mcqs.length === 0) return ReE(res, "No MCQs found for this course", 404);

    let correctCount = 0;
    const results = [];

    // 🔹 Evaluate each MCQ
    for (let ans of answers) {
      const mcq = mcqs.find((m) => String(m.id) === String(ans.mcqId));
      if (!mcq) continue;

      const isCorrect =
        String(mcq.answer).trim().toUpperCase() ===
        String(ans.selectedOption).trim().toUpperCase();

      if (isCorrect) correctCount++;

      results.push({
        mcqId: mcq.id,
        question: mcq.question,
        selectedOption: ans.selectedOption,
        isCorrect,
        correctAnswer: mcq.answer,
      });
    }

    const total = mcqs.length;
    const score = `${correctCount}/${total}`;
    const eligibleForCaseStudy = correctCount === total;

    // 🔹 Update user progress inside SelectedCourseDetail
    let progress = {};
    if (courseDetail.userProgress) {
      progress =
        typeof courseDetail.userProgress === "string"
          ? JSON.parse(courseDetail.userProgress)
          : courseDetail.userProgress;
    }

    progress[userId] = {
      ...progress[userId],
      correctMCQs: correctCount,
      totalMCQs: total,
      eligibleForCaseStudy,
      answers: results,
      updatedAt: new Date().toISOString(),
    };

    await SelectedCourseDetail.update(
      { userProgress: progress },
      { where: { id: courseDetail.id } }
    );

    // 🔹 Update MCQ total score in SelectedQuestionModel
    // We'll store total correct MCQs in mcqresult field (one-time update for domain)
    await SelectedQuestionModel.update(
      { mcqresult: correctCount },
      { where: { selectedDomainId } }
    );

    // 🔹 Send response
    return ReS(
      res,
      {
        success: true,
        evaluation: {
          totalQuestions: total,
          correct: correctCount,
          wrong: total - correctCount,
          score,
          eligibleForCaseStudy,
          results,
        },
      },
      200
    );
  } catch (error) {
    console.error("Evaluate Selected MCQ Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.evaluateSelectedMCQ = evaluateSelectedMCQ;

// ===============================
// Evaluate Case Study
// ===============================

const evaluateCaseStudyAnswer = async (req, res) => {
  try {
    const { selectedDomainId, questionId } = req.params;
    const { userId, answers } = req.body;

    if (!selectedDomainId) return ReE(res, "selectedDomainId is required", 400);
    if (!questionId) return ReE(res, "questionId is required", 400);
    if (!userId) return ReE(res, "userId is required", 400);
    if (!Array.isArray(answers) || answers.length === 0)
      return ReE(res, "answers must be a non-empty array", 400);

    // 🔹 Fetch Case Study question
    const question = await SelectedQuestionModel.findOne({
      where: {
        id: questionId,
        selectedDomainId,
        caseStudy: { [Op.ne]: null },
      },
    });

    if (!question)
      return ReE(res, "Case Study question not found for this domain", 404);

    const results = [];
    let totalPercentage = 0;

    // 🔹 Evaluate answers
    for (let ans of answers) {
      if (String(ans.questionId) !== String(questionId)) continue;

      const keywords = question.keywords ? question.keywords.split(",") : [];
      const userAnswerLower = ans.answer.toLowerCase();
      let matchedCount = 0;

      keywords.forEach((kw) => {
        if (userAnswerLower.includes(kw.trim().toLowerCase())) matchedCount++;
      });

      const matchPercentage = (
        (matchedCount / (keywords.length || 1)) *
        100
      ).toFixed(2);
      const passed = matchPercentage >= 20;

      totalPercentage += parseFloat(matchPercentage);

      // 🔹 Save individual Case Study answers
      await SelectedCaseStudyResult.upsert({
        userId,
        selectedDomainId,
        questionId: question.id,
        answer: ans.answer,
        matchPercentage: parseFloat(matchPercentage),
        passed,
      });

      results.push({
        questionId: question.id,
        question: question.question,
        answer: ans.answer,
        matchPercentage: parseFloat(matchPercentage),
        passed,
      });
    }

    const total = results.length;
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = total - passedCount;
    const caseStudyPercentage =
      total > 0 ? (totalPercentage / total).toFixed(2) : 0;

    let overallStatus = "Incomplete";
    let overallResult = null;

    // 🔹 Fetch MCQ result (from SelectedQuestionModel)
    const mcqRecord = await SelectedQuestionModel.findOne({
      where: { selectedDomainId },
      attributes: ["mcqresult"],
    });

    const mcqScore = mcqRecord ? mcqRecord.mcqresult : 0;

    // Assume total MCQs can be derived or stored in progress (fallback = 10)
    const totalMCQs = mcqScore > 0 ? 10 : 0;
    const mcqPercentage =
      mcqScore && totalMCQs > 0 ? (mcqScore / totalMCQs) * 100 : null;

    // 🔹 Calculate overall percentage
    let overallPercentage;
    if (mcqPercentage !== null) {
      overallPercentage = (
        (parseFloat(caseStudyPercentage) + mcqPercentage) /
        2
      ).toFixed(2);
    } else {
      overallPercentage = parseFloat(caseStudyPercentage);
    }

    const passedMCQs =
      mcqPercentage !== null && mcqPercentage >= 60; // Example pass mark
    const passedCaseStudy = passedCount === total && total > 0;

    // 🔹 If passed both
    if (passedMCQs && passedCaseStudy) {
      const domain = await SelectionDomain.findOne({
        where: { id: selectedDomainId },
        attributes: ["name"],
      });

      if (domain) {
        await Users.update(
          { selected: domain.name },
          { where: { id: userId } }
        );
      }

      overallStatus = "Passed";
      overallResult = {
        domain: domain?.name || null,
        overallPercentage: parseFloat(overallPercentage),
        message: `User has successfully passed both MCQ and Case Study for ${
          domain?.name || "this domain"
        }`,
      };

      // 🔹 Update combined record
      await SelectedCaseStudyResult.upsert({
        userId,
        selectedDomainId,
        questionId,
        answer: "Final Combined Result",
        matchPercentage: parseFloat(caseStudyPercentage),
        passed: true,
      });

      // 🔹 Send congratulatory mail
      const user = await Users.findOne({
        where: { id: userId },
        attributes: ["email", "firstName"],
      });

      if (user?.email) {
        const subject = `🎓 Congratulations on Passing the ${
          domain?.name || "Domain"
        } Assessment!`;
        const html = `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2>Hi ${user.firstName || "Learner"},</h2>
            <p>🎉 Congratulations! You’ve successfully passed both the <strong>MCQ</strong> and <strong>Case Study</strong> for <b>${
              domain?.name
            }</b>.</p>
            <p>Your overall performance: <b>${overallPercentage}%</b></p>
            <p>Keep learning and achieving more milestones with <b>EduRoom</b>!</p>
            <br/>
            <p>Best regards,<br/>The EduRoom Team</p>
          </div>
        `;
        await sendMail(user.email, subject, html);
      }
    } else {
      overallStatus = "Incomplete";
      overallResult = {
        domain: null,
        overallPercentage: parseFloat(overallPercentage),
        message: "User has not yet passed all sections.",
      };
    }

    // 🔹 Response
    return ReS(
      res,
      {
        success: true,
        evaluation: {
          total,
          passed: passedCount,
          failed: failedCount,
          caseStudyPercentage: parseFloat(caseStudyPercentage),
          results,
        },
        overallStatus,
        overallResult,
      },
      200
    );
  } catch (error) {
    console.error("Evaluate Case Study Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.evaluateCaseStudyAnswer = evaluateCaseStudyAnswer;
