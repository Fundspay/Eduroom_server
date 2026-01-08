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

  //  Step 1: get manager name from TeamManagers table
  const manager = await model.TeamManager.findOne({
    where: {
      managerId: managerId,
      isDeleted: false,
      isActive: true,
    },
    attributes: ["name"],
  });

  if (!manager) {
    return { achieved: 0, target: 0, progress: 0 };
  }

  //  Step 2: achieved = all calls done by this manager (name-based)
  const achieved = await model.CoSheet.count({
    where: {
      connectedBy: manager.name,
      dateOfConnect: {
        [Op.between]: [start, end],
      },
    },
  });

  // Step 3: target remains exactly the same
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

  const achieved = await model.CoSheet.count({
    where: {
      teamManagerId: managerId,
      jdSentAt: { [Op.between]: [start, end] },
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

  const achieved = await model.CoSheets.count({
    where: {
      teamManagerId: managerId,
      resumeDate: { [Op.between]: [start, end] },
      followUpResponse: { [Op.ne]: null },
    },
  });

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

  const achieved =
    (await model.CoSheets.sum("resumeCount", {
      where: {
        teamManagerId: managerId,
        resumeDate: { [Op.between]: [start, end] },
      },
    })) || 0;

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
