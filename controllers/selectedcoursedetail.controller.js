"use strict";
const { Op } = require("sequelize");
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
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

module.exports. addOrUpdateSelectedCourseDetail = addOrUpdateSelectedCourseDetail;

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

const evaluateSelectedMCQ = async (req, res) => {
  try {
    const { selectedDomainId } = req.params;
    const { userId, answers } = req.body;

    if (!selectedDomainId) return ReE(res, "selectedDomainId is required", 400);
    if (!userId) return ReE(res, "userId is required", 400);
    if (!Array.isArray(answers)) return ReE(res, "answers must be an array", 400);

    // 🔹 Fetch course detail with all questions
    const courseDetail = await SelectedCourseDetail.findOne({
      where: { selectedDomainId },
      include: [
        {
          model: SelectedQuestionModel,
          required: false,
        },
      ],
    });

    if (!courseDetail) return ReE(res, "Selected course detail not found", 404);

    const mcqs = courseDetail.SelectedQuestionModels || [];
    if (mcqs.length === 0) return ReE(res, "No MCQs found for this course", 404);

    let correctCount = 0;
    const results = [];

    // 🔹 Evaluate answers
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
        keywords: mcq.keywords || null,
        caseStudy: mcq.caseStudy || null,
      });
    }

    const total = mcqs.length;
    const score = `${correctCount}/${total}`;

    // 🔹 Normalize userProgress JSON
    let progress = {};
    if (courseDetail.userProgress) {
      progress =
        typeof courseDetail.userProgress === "string"
          ? JSON.parse(courseDetail.userProgress)
          : courseDetail.userProgress;
    }

    // 🔹 Overwrite existing evaluation for this user (not duplicate)
    progress[userId] = {
      correctMCQs: correctCount,
      totalMCQs: total,
      eligibleForCaseStudy: correctCount === total,
      answers: results, // always replaced, not appended
      updatedAt: new Date().toISOString(),
    };

    // ✅ Ensure courseDetail.id is numeric before updating
    const courseDetailId = Number(courseDetail.id);
    if (isNaN(courseDetailId)) {
      return ReE(res, "Invalid courseDetail ID", 400);
    }

    // 🔹 Update course detail with updated progress
    await SelectedCourseDetail.update(
      { userProgress: progress },
      { where: { id: courseDetailId } }
    );

    return ReS(
      res,
      {
        success: true,
        courseDetail,
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
    console.error("Evaluate Selected MCQ Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.evaluateSelectedMCQ = evaluateSelectedMCQ;

const evaluateCaseStudyAnswer = async (req, res) => {
  try {
    const { selectedDomainId, questionId } = req.params; //  include questionId
    const { userId, answers } = req.body;

    // 🔹 Validate input
    if (!selectedDomainId) return ReE(res, "selectedDomainId is required", 400);
    if (!questionId) return ReE(res, "questionId is required", 400); //  added check
    if (!userId) return ReE(res, "userId is required", 400);
    if (!Array.isArray(answers) || answers.length === 0)
      return ReE(res, "answers must be a non-empty array", 400);

    // 🔹 Fetch the question directly instead of via include
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

    // 🔹 Evaluate only the specific question
    for (let ans of answers) {
      if (String(ans.questionId) !== String(questionId)) continue;

      const keywords = question.keywords ? question.keywords.split(",") : [];
      const userAnswerLower = ans.answer.toLowerCase();
      let matchedCount = 0;

      keywords.forEach((kw) => {
        if (userAnswerLower.includes(kw.trim().toLowerCase())) matchedCount++;
      });

      const matchPercentage = ((matchedCount / (keywords.length || 1)) * 100).toFixed(2);
      const passed = matchPercentage >= 20;

      totalPercentage += parseFloat(matchPercentage);

      // 🔹 Update or insert (no duplicates for same user + question)
      await SelectedCaseStudyResult.upsert({
        userId,
        selectedDomainId,
        questionId: question.id,
        answer: ans.answer,
        matchPercentage,
        passed,
      });

      results.push({
        questionId: question.id,
        question: question.question,
        answer: ans.answer,
        matchPercentage: parseFloat(matchPercentage),
        passed,
        keywords: question.keywords,
        caseStudy: question.caseStudy,
      });
    }

    const total = results.length;
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = total - passedCount;
    const overallPercentage = total > 0 ? (totalPercentage / total).toFixed(2) : 0;

    // 🔹 Update progress
    const courseDetail = await SelectedCourseDetail.findOne({
      where: { selectedDomainId },
    });

    if (courseDetail) {
      let progress = {};
      if (courseDetail.userProgress) {
        progress =
          typeof courseDetail.userProgress === "string"
            ? JSON.parse(courseDetail.userProgress)
            : courseDetail.userProgress;
      }

      progress[userId] = {
        ...(progress[userId] || {}),
        caseStudy: {
          total,
          passed: passedCount,
          failed: failedCount,
          overallPercentage: parseFloat(overallPercentage),
          results,
          updatedAt: new Date().toISOString(),
        },
      };

      await SelectedCourseDetail.update(
        { userProgress: progress },
        { where: { id: courseDetail.id } }
      );
    }

    return ReS(
      res,
      {
        success: true,
        evaluation: {
          total,
          passed: passedCount,
          failed: failedCount,
          overallPercentage: parseFloat(overallPercentage),
          results,
        },
      },
      200
    );
  } catch (error) {
    console.error("Evaluate Case Study Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.evaluateCaseStudyAnswer = evaluateCaseStudyAnswer;



