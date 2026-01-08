"use strict";

const model = require("../models");
const { Op } = require("sequelize");

/**
 * MAIN ENTRY
 * Called from upsertTaskForDay
 */
const calculateSystemTaskProgress = async ({ taskType, managerId, date }) => {
  switch (taskType) {
    case "COLLEGE_CONNECT":
      return await collegeConnectProgress(managerId, date);

    case "JD_SEND":
      return await jdSendProgress(managerId, date);

    case "FOLLOW_UP":
      return await followUpProgress(managerId, date);

    case "RESUME_RECEIVED":
      return await resumeReceivedProgress(managerId, date);

    default:
      return { progress: 0, achieved: 0, target: 0 };
  }
};

/**
 * Utility: day range
 */
const getDayRange = (date) => {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);
  return { start, end };
};

/**
 * HR – COLLEGE CONNECT
 */
const collegeConnectProgress = async (managerId, date) => {
  const { start, end } = getDayRange(date);

  const manager = await model.TeamManager.findByPk(managerId, {
    attributes: ["name"],
  });

  const managerName = manager ? manager.name : null;

  const achieved = managerName
    ? await model.CoSheet.count({
        where: {
          connectedBy: managerName,
          dateOfConnect: { [Op.between]: [start, end] },
        },
      })
    : 0;

  const targetRow = await model.MyTarget.findOne({
    where: { teamManagerId: managerId, targetDate: date },
    attributes: ["calls"],
  });

  const target = targetRow ? Number(targetRow.calls) : 0;
  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;

  return { achieved, target, progress };
};

/**
 * HR – JD SEND
 */
const jdSendProgress = async (managerId, date) => {
  const { start, end } = getDayRange(date);

   const manager = await model.TeamManager.findByPk(managerId, {
    attributes: ["name"],
  });
  const managerName = manager ? manager.name : null;
  const achieved = await model.CoSheet.count({
    where: {
      connectedBy: managerName,
      dateOfConnect: { [Op.between]: [start, end] },

      //  only count if JD was actually sent
      detailedResponse: {
        [Op.iLike]: "%Send JD%",
      },
    },
  });

  const targetRow = await model.MyTarget.findOne({
    where: { teamManagerId: managerId, targetDate: date },
    attributes: ["jds"],
  });

  const target = targetRow ? Number(targetRow.jds) : 0;
  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;

  return { achieved, target, progress };
};

/**
 * HR – FOLLOW UP
 */
const followUpProgress = async (managerId, date) => {
  const { start, end } = getDayRange(date);

  const manager = await model.TeamManager.findByPk(managerId, {
    attributes: ["name"],
  });

  const managerName = manager ? manager.name : null;

  const validResponses = [
    "sending in 1-2 days",
    "delayed",
    "no response",
    "unprofessional",
    "resumes received",
  ];

  const achieved = managerName
    ? await model.CoSheet.count({
        where: {
          followUpBy: managerName,
          followUpResponse: { [Op.in]: validResponses },
          followUpDate: { [Op.between]: [start, end] },
        },
      })
    : 0;

  const targetRow = await model.MyTarget.findOne({
    where: { teamManagerId: managerId, targetDate: date },
    attributes: ["followUps"],
  });

  const target = targetRow ? Number(targetRow.followUps) : 0;
  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;

  return { achieved, target, progress };
};


/**
 * HR – RESUME RECEIVED
 */
const resumeReceivedProgress = async (managerId, date) => {
  const { start, end } = getDayRange(date);

  // 🔹 Get manager name from managerId
  const manager = await model.TeamManager.findByPk(managerId, {
    attributes: ["name"],
  });

  const managerName = manager ? manager.name : null;

  // 🔹 Achieved = total resumes received by this manager
  const achieved = managerName
    ? (await model.CoSheet.sum("resumeCount", {
        where: {
          connectedBy: managerName,
          followUpResponse: "resumes received", // <-- added filter
          resumeDate: { [Op.between]: [start, end] },
        },
      })) || 0
    : 0;

  const targetRow = await model.MyTarget.findOne({
    where: { teamManagerId: managerId, targetDate: date },
    attributes: ["resumes"],
  });

  const target = targetRow ? Number(targetRow.resumes) : 0;
  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;

  return { achieved, target, progress };
};


module.exports = {
  calculateSystemTaskProgress,
};
