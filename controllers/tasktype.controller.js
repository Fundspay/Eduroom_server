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
 * Target comes strictly from `calls` column
 */
const collegeConnectProgress = async (managerId, date) => {
  const achieved = await model.CoSheet.count({
    where: { teamManagerId: managerId, dateOfConnect: date },
  });

  const targetRow = await model.MyTarget.findOne({
    where: { teamManagerId: managerId },
    targetDate: date, 
    attributes: ["calls"], // strictly use calls
    order: [["targetDate", "DESC"]], // get latest target if multiple
  });

  const target = targetRow ? Number(targetRow.calls) : 0;
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
    order: [["targetDate", "DESC"]],
  });

  const target = targetRow ? Number(targetRow.jds) : 0;
  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;

  return { achieved, target, progress };
};

/**
 * HR – FOLLOW UP
 */
const followUpProgress = async (managerId, date) => {
  const achieved = await model.CoSheets.count({
    where: {
      teamManagerId: managerId,
      resumeDate: date,
      followUpResponse: { [Op.ne]: null },
    },
  });

  const targetRow = await model.MyTarget.findOne({
    where: { teamManagerId: managerId },
    attributes: ["followUps"],
    order: [["targetDate", "DESC"]],
  });

  const target = targetRow ? Number(targetRow.followUps) : 0;
  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;

  return { achieved, target, progress };
};

/**
 * HR – RESUME RECEIVED
 */
const resumeReceivedProgress = async (managerId, date) => {
  const achieved =
    (await model.CoSheets.sum("resumeCount", {
      where: { teamManagerId: managerId, resumeDate: date },
    })) || 0;

  const targetRow = await model.MyTarget.findOne({
    where: { teamManagerId: managerId },
    attributes: ["resumes"], // assuming resumes target
    order: [["targetDate", "DESC"]],
  });

  const target = targetRow ? Number(targetRow.resumes) : 0;
  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;

  return { achieved, target, progress };
};

module.exports = {
  calculateSystemTaskProgress,
};
