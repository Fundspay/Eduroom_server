"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { SelectedCourseDetail, SelectedQuestionModel, SelectionDomain, sequelize } = require("../models");


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