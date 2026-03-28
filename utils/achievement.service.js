"use strict";

const model = require("../models");
const { Op } = require("sequelize");

// ─────────────────────────────────────────────
// Utility — get full month date range
// ─────────────────────────────────────────────
const getMonthRange = (periodMonth, periodYear) => {
  const start = new Date(periodYear, periodMonth - 1, 1, 0, 0, 0, 0);
  const end = new Date(periodYear, periodMonth, 0, 23, 59, 59, 999);
  return { start, end };
};

// ─────────────────────────────────────────────
// Utility — get manager name by managerId
// ─────────────────────────────────────────────
const getManagerName = async (managerId) => {
  const manager = await model.TeamManager.findByPk(managerId, {
    attributes: ["name"],
  });
  return manager ? manager.name : null;
};

// ─────────────────────────────────────────────
// Utility — get all userIds under this manager
// ─────────────────────────────────────────────
const getUserIdsByManager = async (managerName) => {
  if (!managerName) return [];
  const statuses = await model.Status.findAll({
    where: { teamManager: managerName },
    attributes: ["userId"],
  });
  return statuses.map((s) => s.userId);
};

// ─────────────────────────────────────────────
// BD — Paid Accounts (FundsAudit)
// ─────────────────────────────────────────────
const getBdAccounts = async (managerId, periodMonth, periodYear) => {
  const { start, end } = getMonthRange(periodMonth, periodYear);
  const managerName = await getManagerName(managerId);
  const userIds = await getUserIdsByManager(managerName);

  if (!userIds.length) return 0;

  const payments = await model.FundsAudit.findAll({
    where: {
      userId: userIds,
      hasPaid: true,
      dateOfPayment: { [Op.between]: [start, end] },
    },
    attributes: ["dateOfPayment"],
    raw: true,
  });

  return payments.filter((p) => {
    let paymentDate;
    if (typeof p.dateOfPayment === "string") {
      paymentDate = p.dateOfPayment.split("T")[0];
    } else {
      const d = new Date(p.dateOfPayment);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      paymentDate = `${year}-${month}-${day}`;
    }
    const monthStr = `${periodYear}-${String(periodMonth).padStart(2, "0")}`;
    return paymentDate.startsWith(monthStr);
  }).length;
};

// ─────────────────────────────────────────────
// BD — Interns Active (BdSheet)
// ─────────────────────────────────────────────
const getBdInternsActive = async (managerId, periodMonth, periodYear) => {
  const { start, end } = getMonthRange(periodMonth, periodYear);

  const achieved = await model.BdSheet.count({
    where: {
      teamManagerId: managerId,
      activeStatus: "Active",
      startDate: { [Op.between]: [start, end] },
    },
    distinct: true,
    col: "studentResumeId",
  });

  return achieved;
};

// ─────────────────────────────────────────────
// BD — Interns Allocated (BdSheet)
// ─────────────────────────────────────────────
const getBdInternsAllocated = async (managerId, periodMonth, periodYear) => {
  const { start, end } = getMonthRange(periodMonth, periodYear);

  const achieved = await model.BdSheet.count({
    where: {
      teamManagerId: managerId,
      startDate: { [Op.between]: [start, end] },
    },
    distinct: true,
    col: "studentResumeId",
  });

  return achieved;
};

// ─────────────────────────────────────────────
// HR — College Connect (CoSheet)
// ─────────────────────────────────────────────
const getHrCollegeConnect = async (managerId, periodMonth, periodYear) => {
  const { start, end } = getMonthRange(periodMonth, periodYear);
  const managerName = await getManagerName(managerId);
  if (!managerName) return 0;

  return await model.CoSheet.count({
    where: {
      connectedBy: managerName,
      dateOfConnect: { [Op.between]: [start, end] },
    },
  });
};

// ─────────────────────────────────────────────
// HR — JD Send (CoSheet)
// ─────────────────────────────────────────────
const getHrJdSend = async (managerId, periodMonth, periodYear) => {
  const { start, end } = getMonthRange(periodMonth, periodYear);
  const managerName = await getManagerName(managerId);
  if (!managerName) return 0;

  return await model.CoSheet.count({
    where: {
      connectedBy: managerName,
      dateOfConnect: { [Op.between]: [start, end] },
      detailedResponse: { [Op.iLike]: "%Send JD%" },
    },
  });
};

// ─────────────────────────────────────────────
// HR — Follow Up (CoSheet)
// ─────────────────────────────────────────────
const getHrFollowUp = async (managerId, periodMonth, periodYear) => {
  const { start, end } = getMonthRange(periodMonth, periodYear);
  const managerName = await getManagerName(managerId);
  if (!managerName) return 0;

  const validResponses = [
    "sending in 1-2 days",
    "delayed",
    "no response",
    "unprofessional",
    "resumes received",
  ];

  return await model.CoSheet.count({
    where: {
      followUpBy: managerName,
      followUpResponse: { [Op.in]: validResponses },
      followUpDate: { [Op.between]: [start, end] },
    },
  });
};

// ─────────────────────────────────────────────
// HR — Resume Received (CoSheet)
// ─────────────────────────────────────────────
const getHrResumeReceived = async (managerId, periodMonth, periodYear) => {
  const { start, end } = getMonthRange(periodMonth, periodYear);
  const managerName = await getManagerName(managerId);
  if (!managerName) return 0;

  const total = await model.CoSheet.sum("resumeCount", {
    where: {
      connectedBy: managerName,
      followUpResponse: "resumes received",
      resumeDate: { [Op.between]: [start, end] },
    },
  });

  return total || 0;
};

// ─────────────────────────────────────────────
// HR — Selected Colleges (StudentResume)
// ─────────────────────────────────────────────
const getHrSelectedColleges = async (managerId, periodMonth, periodYear) => {
  const { start, end } = getMonthRange(periodMonth, periodYear);
  const managerName = await getManagerName(managerId);
  if (!managerName) return 0;

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
  resumes.forEach((r) => { if (r.collegeName) uniqueColleges.add(r.collegeName); });

  return uniqueColleges.size;
};

// ─────────────────────────────────────────────
// HR — Selection / Hires (StudentResume)
// ─────────────────────────────────────────────
const getHrSelection = async (managerId, periodMonth, periodYear) => {
  const { start, end } = getMonthRange(periodMonth, periodYear);
  const managerName = await getManagerName(managerId);
  if (!managerName) return 0;

  return await model.StudentResume.count({
    where: {
      interviewedBy: managerName,
      finalSelectionStatus: "Selected",
      Dateofonboarding: { [Op.between]: [start, end] },
    },
  });
};

// ─────────────────────────────────────────────
// MAIN — resolve source key to actual DB value
// ─────────────────────────────────────────────
const resolveSourceValue = async (source, managerId, periodMonth, periodYear) => {
  switch (source) {
    case "BD_ACCOUNTS":
      return await getBdAccounts(managerId, periodMonth, periodYear);
    case "BD_INTERNS_ACTIVE":
      return await getBdInternsActive(managerId, periodMonth, periodYear);
    case "BD_INTERNS_ALLOCATED":
      return await getBdInternsAllocated(managerId, periodMonth, periodYear);
    case "HR_COLLEGE_CONNECT":
      return await getHrCollegeConnect(managerId, periodMonth, periodYear);
    case "HR_JD_SEND":
      return await getHrJdSend(managerId, periodMonth, periodYear);
    case "HR_FOLLOW_UP":
      return await getHrFollowUp(managerId, periodMonth, periodYear);
    case "HR_RESUME_RECEIVED":
      return await getHrResumeReceived(managerId, periodMonth, periodYear);
    case "HR_SELECTED_COLLEGES":
      return await getHrSelectedColleges(managerId, periodMonth, periodYear);
    case "HR_SELECTION":
      return await getHrSelection(managerId, periodMonth, periodYear);
    case "MANUAL":
      return 0; // manual — admin will enter value separately
    default:
      return 0;
  }
};

module.exports = { resolveSourceValue };