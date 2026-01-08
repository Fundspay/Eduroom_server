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

    case "HR [SELECTED-COLLAGES]":
      return await selectedCollegesProgress(managerId, date);

    case "HR [SELECTION]":
      return await hrSelectionProgress(managerId, date);

    // 🔹 NEW BD TASKS
    case "BD [INTERNS ALLOCATED]":
      return await bdInternsAllocatedProgress(managerId, date);

    case "BD [INTERNS ACTIVE]":
      return await bdInternsActiveProgress(managerId, date);

    case "BD [ACCOUNTS]":
      return await bdAccountsProgress(managerId, date);

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
      detailedResponse: { [Op.iLike]: "%Send JD%" },
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

  const manager = await model.TeamManager.findByPk(managerId, {
    attributes: ["name"],
  });

  const managerName = manager ? manager.name : null;

  const achieved = managerName
    ? (await model.CoSheet.sum("resumeCount", {
        where: {
          connectedBy: managerName,
          followUpResponse: "resumes received",
          resumeDate: { [Op.between]: [start, end] },
        },
      })) || 0
    : 0;

  const targetRow = await model.MyTarget.findOne({
    where: { teamManagerId: managerId, targetDate: date },
    attributes: ["resumetarget"],
  });

  const target = targetRow ? Number(targetRow.resumetarget) : 0;
  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;

  return { achieved, target, progress };
};

/**
 * HR – SELECTED COLLEGES
 */
const selectedCollegesProgress = async (managerId, date) => {
  const { start, end } = getDayRange(date);

  const manager = await model.TeamManager.findByPk(managerId, {
    attributes: ["name"],
  });

  const managerName = manager ? manager.name : null;

  let achieved = 0;
  if (managerName) {
    const resumes = await model.StudentResume.findAll({
      where: {
        interviewedBy: managerName,
        [Op.or]: [
          { Dateofonboarding: { [Op.between]: [start, end] } },
          { Dateofonboarding: null, updatedAt: { [Op.between]: [start, end] } },
        ],
      },
      attributes: ["collegeName"],
      raw: true,
    });

    const uniqueColleges = new Set();
    resumes.forEach((r) => {
      if (r.collegeName) uniqueColleges.add(r.collegeName);
    });

    achieved = uniqueColleges.size;
  }

  const targetRow = await model.MyTarget.findOne({
    where: { teamManagerId: managerId, targetDate: date },
    attributes: ["collegeTarget"],
  });

  const target = targetRow ? Number(targetRow.collegeTarget) : 0;
  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;

  return { achieved, target, progress };
};

/**
 * HR – SELECTION
 */
const hrSelectionProgress = async (managerId, date) => {
  const { start, end } = getDayRange(date);

  const manager = await model.TeamManager.findByPk(managerId, {
    attributes: ["name"],
  });

  const managerName = manager ? manager.name : null;

  const achieved = managerName
    ? await model.StudentResume.count({
        where: {
          interviewedBy: managerName,
          finalSelectionStatus: "Selected",
          Dateofonboarding: { [Op.between]: [start, end] },
        },
      })
    : 0;

  const targetRow = await model.MyTarget.findOne({
    where: { teamManagerId: managerId, targetDate: date },
    attributes: ["resumesReceivedTarget"],
  });

  const target = targetRow ? Number(targetRow.resumesReceivedTarget) : 0;
  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;

  return { achieved, target, progress };
};

/**
 * BD – INTERNS ALLOCATED
 */
const bdInternsAllocatedProgress = async (managerId, date) => {
  const { start, end } = getDayRange(date);

  const targetRow = await model.BdTarget.findOne({
    where: { teamManagerId: managerId, targetDate: date },
    attributes: ["internsAllocated"],
  });

  const target = targetRow ? Number(targetRow.internsAllocated) : 0;

  const achieved = await model.BdSheet.count({
    where: {
      teamManagerId: managerId,
      startDate: { [Op.between]: [start, end] },
    },
    distinct: true,
    col: "studentResumeId",
  });

  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;
  return { achieved, target, progress };
};

/**
 * BD – INTERNS ACTIVE
 */
const bdInternsActiveProgress = async (managerId, date) => {
  const { start, end } = getDayRange(date);

  const targetRow = await model.BdTarget.findOne({
    where: { teamManagerId: managerId, targetDate: date },
    attributes: ["internsActive"],
  });

  const target = targetRow ? Number(targetRow.internsActive) : 0;

  const achieved = await model.BdSheet.count({
    where: {
      teamManagerId: managerId,
      activeStatus: "Active",
      startDate: { [Op.between]: [start, end] },
    },
    distinct: true,
    col: "studentResumeId",
  });

  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;
  return { achieved, target, progress };
};

/**
 * BD – ACCOUNTS
 */
const bdAccountsProgress = async (managerId, date) => {
  const { start, end } = getDayRange(date);

  const targetRow = await model.BdTarget.findOne({
    where: { teamManagerId: managerId, targetDate: date },
    attributes: ["accounts"],
  });

  const target = targetRow ? Number(targetRow.accounts) : 0;

  const sheets = await model.BdSheet.findAll({
    where: {
      teamManagerId: managerId,
      startDate: { [Op.between]: [start, end] },
    },
    include: [
      {
        model: model.StudentResume,
        required: true,
        attributes: ["mobileNumber"],
      },
    ],
  });

  const mobileNumbers = [
    ...new Set(
      sheets.map(s => s.StudentResume?.mobileNumber).filter(Boolean)
    ),
  ];

  let achieved = 0;
  if (mobileNumbers.length) {
    const users = await model.User.findAll({
      where: { phoneNumber: { [Op.in]: mobileNumbers } },
      attributes: ["subscriptionWallet"],
    });

    users.forEach(u => {
      achieved += Number(u.subscriptionWallet || 0);
    });
  }

  const progress = target > 0 ? Math.round((achieved / target) * 100) : 0;
  return { achieved, target, progress };
};

module.exports = {
  calculateSystemTaskProgress,
};
