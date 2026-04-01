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

  // NOTE: Op.between already filters the month range
  // secondary JS filter removed — was redundant
  return payments.length;
};

// ─────────────────────────────────────────────
// BD — Interns Active (BdSheet)
// ─────────────────────────────────────────────
const getBdInternsActive = async (managerId, periodMonth, periodYear) => {
  const { start, end } = getMonthRange(periodMonth, periodYear);

  const achieved = await model.BdSheet.count({
    where: {
      teamManagerId: managerId,
      activeStatus: "active", // ⚠️ keep consistent with DB casing
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
  resumes.forEach((r) => {
    if (r.collegeName) uniqueColleges.add(r.collegeName);
  });

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
// MARKETING — Qualified Leads
// Sum of qualifiedLeads across all approved interns
// under this manager who submitted in the given period
// ─────────────────────────────────────────────
const getMarketingQualifiedLeads = async (managerId, periodMonth, periodYear) => {
  const { start, end } = getMonthRange(periodMonth, periodYear);

  const result = await model.User.findAll({
    where: {
      assignedTeamManager: managerId,
      marketingVerificationStatus: "approved",
      marketingSubmittedAt: { [Op.between]: [start, end] },
      qualifiedLeads: { [Op.ne]: null },
      isDeleted: false,
    },
    attributes: ["qualifiedLeads"],
    raw: true,
  });

  return result.reduce((sum, u) => sum + (parseInt(u.qualifiedLeads) || 0), 0);
};

// ─────────────────────────────────────────────
// MARKETING — Reviews
// Sum of reviews across all approved interns for the period
// ─────────────────────────────────────────────
const getMarketingReviews = async (managerId, periodMonth, periodYear) => {
  const { start, end } = getMonthRange(periodMonth, periodYear);

  const result = await model.User.findAll({
    where: {
      assignedTeamManager: managerId,
      marketingVerificationStatus: "approved",
      marketingSubmittedAt: { [Op.between]: [start, end] },
      reviews: { [Op.ne]: null },
      isDeleted: false,
    },
    attributes: ["reviews"],
    raw: true,
  });

  return result.reduce((sum, u) => sum + (parseInt(u.reviews) || 0), 0);
};

// ─────────────────────────────────────────────
// MARKETING — Ratings
// Average of ratings across all approved interns for the period
// Returns 0 if no approved interns with ratings
// ─────────────────────────────────────────────
const getMarketingRatings = async (managerId, periodMonth, periodYear) => {
  const { start, end } = getMonthRange(periodMonth, periodYear);

  const result = await model.User.findAll({
    where: {
      assignedTeamManager: managerId,
      marketingVerificationStatus: "approved",
      marketingSubmittedAt: { [Op.between]: [start, end] },
      ratings: { [Op.ne]: null },
      isDeleted: false,
    },
    attributes: ["ratings"],
    raw: true,
  });

  if (!result.length) return 0;

  const total = result.reduce((sum, u) => sum + (parseFloat(u.ratings) || 0), 0);
  return parseFloat((total / result.length).toFixed(2));
};

// ─────────────────────────────────────────────
// MARKETING — Followers Growth
// Sum of followersGrowth across all approved interns for the period
// Note: BRD multiplier is 25 coins per 10 followers
// The raw count is returned here — multiplier applied in calculateDeptCoins
// ─────────────────────────────────────────────
const getMarketingFollowersGrowth = async (managerId, periodMonth, periodYear) => {
  const { start, end } = getMonthRange(periodMonth, periodYear);

  const result = await model.User.findAll({
    where: {
      assignedTeamManager: managerId,
      marketingVerificationStatus: "approved",
      marketingSubmittedAt: { [Op.between]: [start, end] },
      followersGrowth: { [Op.ne]: null },
      isDeleted: false,
    },
    attributes: ["followersGrowth"],
    raw: true,
  });

  return result.reduce((sum, u) => sum + (parseInt(u.followersGrowth) || 0), 0);
};

// ─────────────────────────────────────────────
// RETENTION RATE — active interns / total allocated
// retentionRate = (activeInterns / totalAllocated) * 100
// ─────────────────────────────────────────────
const getRetentionRate = async (managerId, periodMonth, periodYear) => {
  const { start, end } = getMonthRange(periodMonth, periodYear);

  const totalAllocated = await model.BdSheet.count({
    where: {
      teamManagerId: managerId,
      startDate: { [Op.between]: [start, end] },
    },
    distinct: true,
    col: "studentResumeId",
  });

  if (!totalAllocated) return 0;

  // ⚠️ Fixed: use "Active" (capital A) to match getBdInternsActive
  const totalActive = await model.BdSheet.count({
    where: {
      teamManagerId: managerId,
      activeStatus: "active",
      startDate: { [Op.between]: [start, end] },
    },
    distinct: true,
    col: "studentResumeId",
  });

  return parseFloat(((totalActive / totalAllocated) * 100).toFixed(2));
};

// ─────────────────────────────────────────────
// MAIN — resolve source key to actual DB value
// ─────────────────────────────────────────────
const resolveSourceValue = async (source, managerId, periodMonth, periodYear) => {
  switch (source) {
    // ── BD ──
    case "BD_ACCOUNTS":
      return await getBdAccounts(managerId, periodMonth, periodYear);
    case "BD_INTERNS_ACTIVE":
      return await getBdInternsActive(managerId, periodMonth, periodYear);
    case "BD_INTERNS_ALLOCATED":
      return await getBdInternsAllocated(managerId, periodMonth, periodYear);

    // ── HR ──
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

    // ── MARKETING ──
    case "MARKETING_QUALIFIED_LEADS":
      return await getMarketingQualifiedLeads(managerId, periodMonth, periodYear);
    case "MARKETING_REVIEWS":
      return await getMarketingReviews(managerId, periodMonth, periodYear);
    case "MARKETING_RATINGS":
      return await getMarketingRatings(managerId, periodMonth, periodYear);
    case "MARKETING_FOLLOWERS_GROWTH":
      return await getMarketingFollowersGrowth(managerId, periodMonth, periodYear);

    // ── MANUAL or unknown — return 0, value comes from config ──
    case "MANUAL":
    default:
      return 0;
  }
};

module.exports = { resolveSourceValue, getRetentionRate };