"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { SelectedCourseDetail, SelectedQuestionModel, sequelize } = require("../models");

// 🔹 Add or update SelectedCourseDetail
const addOrUpdateSelectedCourseDetail = async (req, res) => {
  const { selectedCourseId, userId, days } = req.body;

  if (!selectedCourseId) return ReE(res, "selectedCourseId is required", 400);
  if (!Array.isArray(days) || days.length === 0)
    return ReE(res, "days are required", 400);

  const transaction = await sequelize.transaction();
  try {
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

        // 🔹 Find or create session row
        let currentSessionRow = await SelectedCourseDetail.findOne({
          where: { selectedCourseId, day, sessionNumber },
          transaction,
        });

        if (!currentSessionRow) {
          currentSessionRow = await SelectedCourseDetail.create(
            {
              selectedCourseId,
              userId: userId ?? null,
              day,
              sessionNumber,
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
              heading,
            },
            { transaction }
          );
        }

        // 🔹 Handle questions
        if (Array.isArray(questions)) {
          const existingQuestions = await SelectedQuestionModel.findAll({
            where: { selectedCourseId, day, sessionNumber },
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
                  questionNumber: index + 1,
                },
                { transaction }
              );
              incomingIds.push(qId);
            } else {
              const newQ = await SelectedQuestionModel.create(
                {
                  selectedCourseId,
                  userId,
                  day,
                  sessionNumber,
                  question: q.question,
                  optionA: q.optionA,
                  optionB: q.optionB,
                  optionC: q.optionC,
                  optionD: q.optionD,
                  answer: q.answer,
                  keywords: q.keywords ?? null,
                  caseStudy: q.caseStudy ?? null,
                  questionNumber: index + 1,
                },
                { transaction }
              );
              incomingIds.push(newQ.id);
            }
          }

          // 🔹 Delete removed questions
          const toDelete = existingQuestions.filter(
            (q) => !incomingIds.includes(q.id)
          );

          if (toDelete.length > 0) {
            const deleteIds = toDelete.map((q) => q.id);
            await SelectedQuestionModel.destroy({
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
    console.error("Add/Update SelectedCourseDetail Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.addOrUpdateSelectedCourseDetail = addOrUpdateSelectedCourseDetail;

// 🔹 Delete SelectedCourseDetail
const deleteSelectedCourseDetail = async (req, res) => {
  const { selectedCourseDetailId, selectedCourseId, day, sessionNumber } = req.params;

  if (!selectedCourseDetailId && (!selectedCourseId || !day || !sessionNumber)) {
    return ReE(
      res,
      "Either selectedCourseDetailId OR (selectedCourseId, day, sessionNumber) is required",
      400
    );
  }

  const transaction = await sequelize.transaction();
  try {
    let selectedCourseDetail;

    if (selectedCourseDetailId) {
      // 🔹 Delete by primary key
      selectedCourseDetail = await SelectedCourseDetail.findByPk(selectedCourseDetailId, {
        transaction,
      });
    } else {
      // 🔹 Delete by selectedCourseId + day + sessionNumber
      selectedCourseDetail = await SelectedCourseDetail.findOne({
        where: { selectedCourseId, day, sessionNumber },
        transaction,
      });
    }

    if (!selectedCourseDetail) {
      await transaction.rollback();
      return ReE(res, "SelectedCourseDetail not found", 404);
    }

    // 🔹 Delete associated questions
    await SelectedQuestionModel.destroy({
      where: { selectedCourseId: selectedCourseDetail.selectedCourseId, day, sessionNumber },
      transaction,
    });

    // 🔹 Hard delete the SelectedCourseDetail entry
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
    console.error("Delete SelectedCourseDetail Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.deleteSelectedCourseDetail = deleteSelectedCourseDetail;
