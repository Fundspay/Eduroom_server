"use strict";

const model = require("../models");
const { Op, fn, col } = require("sequelize");

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
 * HR – COLLEGE CONNECT
 */
const collegeConnectProgress = async (managerId, date) => {
  const achieved = await model.CoSheet.count({
    where: { teamManagerId: managerId, dateOfConnect: date },
  });

  const targetRow = await model.MyTarget.findOne({
    where: { teamManagerId: managerId },
    attributes: ["calls"],
  });

  const target = targetRow ? targetRow.calls : 0;
  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;

  return { achieved, target, progress };
};

/**
 * HR – JD SEND
 */
const jdSendProgress = async (managerId, date) => {
  const achieved = await model.CoSheet.count({
    where: { teamManagerId: managerId, jdSentAt: date },
  });

  const targetRow = await model.MyTarget.findOne({
    where: { teamManagerId: managerId },
    attributes: ["jds"],
  });

  const target = targetRow ? targetRow.jds : 0;
  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;

  return { achieved, target, progress };
};

/**
 * HR – FOLLOW UP
 */
const followUpProgress = async (managerId, date) => {
  const achieved = await model.CoSheets.count({
    where: { teamManagerId: managerId, resumeDate: date, followUpResponse: { [Op.ne]: null } },
  });

  const targetRow = await model.MyTarget.findOne({
    where: { teamManagerId: managerId },
    attributes: ["followUps"], // assuming you have followUps in MyTarget
  });

  const target = targetRow ? targetRow.followUps : 0;
  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;

  return { achieved, target, progress };
};

/**
 * HR – RESUME RECEIVED
 */
const resumeReceivedProgress = async (managerId, date) => {
  const achieved = await model.CoSheets.sum("resumeCount", {
    where: { teamManagerId: managerId, resumeDate: date },
  }) || 0;

  const targetRow = await model.MyTarget.findOne({
    where: { teamManagerId: managerId },
    attributes: ["resumes"], // assuming you have resumes target
  });

  const target = targetRow ? targetRow.resumes : 0;
  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;

  return { achieved, target, progress };
};

module.exports = {
  calculateSystemTaskProgress,
};
