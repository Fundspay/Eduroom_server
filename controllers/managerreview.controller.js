"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const moment = require("moment-timezone");
const { Op } = require("sequelize");

// ─────────────────────────────────────────────
// 1. SUBMIT REVIEW — one manager reviews another
// ─────────────────────────────────────────────
var submitReview = async (req, res) => {
  try {
    const { targetManagerId, reviewerManagerId, reviewerType, starRating, comment, reviewDate } =
      req.body;

    // Validate required fields
    if (!targetManagerId || !reviewerManagerId || !reviewerType || !starRating || !reviewDate) {
      return ReE(res, "Missing required fields: targetManagerId, reviewerManagerId, reviewerType, starRating, reviewDate", 400);
    }

    // Reviewer cannot review themselves
    if (parseInt(targetManagerId) === parseInt(reviewerManagerId)) {
      return ReE(res, "A manager cannot review themselves", 400);
    }

    // Validate star rating range
    const rating = parseFloat(starRating);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return ReE(res, "starRating must be between 1.0 and 5.0", 400);
    }

    // Validate reviewerType
    const validTypes = ["intern", "peer", "cross", "manager", "leadership"];
    if (!validTypes.includes(reviewerType)) {
      return ReE(res, `reviewerType must be one of: ${validTypes.join(", ")}`, 400);
    }

    // Validate target manager exists
    const targetManager = await model.TeamManager.findOne({
      where: { id: targetManagerId, isDeleted: false },
    });
    if (!targetManager) return ReE(res, "Target manager not found", 404);

    // Validate reviewer manager exists
    const reviewerManager = await model.TeamManager.findOne({
      where: { id: reviewerManagerId, isDeleted: false },
    });
    if (!reviewerManager) return ReE(res, "Reviewer manager not found", 404);

    // Extract periodMonth and periodYear from reviewDate
    const parsedDate = moment(reviewDate, "YYYY-MM-DD");
    if (!parsedDate.isValid()) return ReE(res, "reviewDate must be in YYYY-MM-DD format", 400);

    const periodMonth = parsedDate.month() + 1; // moment months are 0-indexed
    const periodYear = parsedDate.year();

    // Check for duplicate — one review per reviewer per target per day
    const existing = await model.ManagerReview.findOne({
      where: {
        targetManagerId,
        reviewerManagerId,
        reviewerType,
        reviewDate,
        isDeleted: false,
      },
    });
    if (existing) {
      return ReE(res, "You have already submitted a review for this manager today", 409);
    }

    // Create review
    const review = await model.ManagerReview.create({
      targetManagerId,
      reviewerManagerId,
      reviewerType,
      starRating: rating,
      comment: comment || null,
      reviewDate,
      periodMonth,
      periodYear,
    });

    return ReS(res, { success: true, message: "Review submitted successfully", data: review }, 201);
  } catch (error) {
    console.error("Submit Review Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.submitReview = submitReview;

// ─────────────────────────────────────────────
// 2. GET MONTHLY SUMMARY — avg rating per reviewerType for a manager in a month
// Used by calculateAchievement to feed into 360° ratings
// ─────────────────────────────────────────────
var getMonthlySummary = async (req, res) => {
  try {
    const { targetManagerId, periodMonth, periodYear } = req.body;

    if (!targetManagerId || !periodMonth || !periodYear) {
      return ReE(res, "Missing required fields: targetManagerId, periodMonth, periodYear", 400);
    }

    // Fetch all reviews for this manager in this month
    const reviews = await model.ManagerReview.findAll({
      where: {
        targetManagerId,
        periodMonth,
        periodYear,
        isDeleted: false,
      },
      attributes: ["reviewerType", "starRating", "reviewDate", "comment"],
      raw: true,
    });

    if (!reviews.length) {
      return ReS(res, { success: true, message: "No reviews found for this period", data: [], averagesByType: {} }, 200);
    }

    // Group and average by reviewerType
    const grouped = {};
    reviews.forEach((r) => {
      if (!grouped[r.reviewerType]) grouped[r.reviewerType] = [];
      grouped[r.reviewerType].push(parseFloat(r.starRating));
    });

    const averagesByType = {};
    Object.keys(grouped).forEach((type) => {
      const ratings = grouped[type];
      const avg = ratings.reduce((sum, val) => sum + val, 0) / ratings.length;
      averagesByType[type] = parseFloat(avg.toFixed(2));
    });

    // Format reviews with IST timestamps
    const formattedReviews = reviews.map((r) => ({
      ...r,
      starRating: parseFloat(r.starRating),
    }));

    return ReS(
      res,
      {
        success: true,
        message: "Monthly review summary fetched successfully",
        averagesByType,   // { intern: 4.5, peer: 4.2, cross: 4.0, manager: 4.3, leadership: 4.1 }
        totalReviews: reviews.length,
        data: formattedReviews,
      },
      200
    );
  } catch (error) {
    console.error("Get Monthly Summary Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getMonthlySummary = getMonthlySummary;

// ─────────────────────────────────────────────
// 3. GET ALL REVIEWS — all reviews received by a manager (paginated)
// ─────────────────────────────────────────────
var getReviewsByManager = async (req, res) => {
  try {
    const { targetManagerId, periodMonth, periodYear } = req.body;

    if (!targetManagerId) return ReE(res, "targetManagerId is required", 400);

    const whereClause = {
      targetManagerId,
      isDeleted: false,
    };

    // Optional month/year filter
    if (periodMonth) whereClause.periodMonth = periodMonth;
    if (periodYear) whereClause.periodYear = periodYear;

    const reviews = await model.ManagerReview.findAll({
      where: whereClause,
      order: [["reviewDate", "DESC"]],
    });

    const formattedReviews = reviews.map((r) => ({
      ...r.dataValues,
      starRating: parseFloat(r.starRating),
      createdAt: moment(r.createdAt).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
      updatedAt: moment(r.updatedAt).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
    }));

    return ReS(
      res,
      {
        success: true,
        message: "Reviews fetched successfully",
        total: formattedReviews.length,
        data: formattedReviews,
      },
      200
    );
  } catch (error) {
    console.error("Get Reviews By Manager Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getReviewsByManager = getReviewsByManager;

// ─────────────────────────────────────────────
// 4. UPDATE REVIEW — reviewer updates their review for the day
// ─────────────────────────────────────────────
var updateReview = async (req, res) => {
  try {
    const { id, starRating, comment } = req.body;

    if (!id) return ReE(res, "Review ID is required", 400);

    const review = await model.ManagerReview.findOne({
      where: { id, isDeleted: false },
    });
    if (!review) return ReE(res, "Review not found", 404);

    // Validate star rating if provided
    if (starRating !== undefined) {
      const rating = parseFloat(starRating);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        return ReE(res, "starRating must be between 1.0 and 5.0", 400);
      }
      review.starRating = rating;
    }

    if (comment !== undefined) review.comment = comment;

    await review.save();

    return ReS(res, { success: true, message: "Review updated successfully", data: review }, 200);
  } catch (error) {
    console.error("Update Review Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.updateReview = updateReview;

// ─────────────────────────────────────────────
// 5. DELETE REVIEW — soft delete
// ─────────────────────────────────────────────
var deleteReview = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) return ReE(res, "Review ID is required", 400);

    const review = await model.ManagerReview.findOne({
      where: { id, isDeleted: false },
    });
    if (!review) return ReE(res, "Review not found", 404);

    review.isDeleted = true;
    await review.save();

    return ReS(res, { success: true, message: "Review deleted successfully" }, 200);
  } catch (error) {
    console.error("Delete Review Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.deleteReview = deleteReview;

var getAllReviews = async (req, res) => {
  try {
    const { managerId } = req.params;
    const { periodMonth, periodYear } = req.query;

    if (!managerId) return ReE(res, "managerId is required", 400);

    // ── Step 1: Get manager name ──
    const managerRecord = await model.TeamManager.findByPk(managerId, {
      attributes: ["id", "name", "email", "department", "position"],
    });
    if (!managerRecord) return ReE(res, "Manager not found", 404);

    const managerName = managerRecord.name;

    // ── Step 2: Fetch intern reviews from analysis1 ──
    const statuses = await model.Status.findAll({
      where: { teamManager: managerName },
      attributes: ["userId"],
      raw: true,
    });

    const internUserIds = statuses.map((s) => s.userId);
    let internBreakdown = [];
    let internAvgRating = 0;

    if (internUserIds.length > 0) {
      const internRatings = await Promise.all(
        internUserIds.map(async (uid) => {
          // Fetch user basic info
          const user = await model.User.findOne({
            where: { id: uid, isDeleted: false },
            attributes: ["id", "firstName", "lastName", "email"],
          });

          const days = await model.analysis1.findAll({
            where: { user_id: uid, isRated: true },
            attributes: ["day_no", "starRating", "ratingComment"],
            raw: true,
          });

          // Unrated interns count as 0
          if (!days.length) {
            return {
              userId: uid,
              userName: user ? `${user.firstName} ${user.lastName}` : "Unknown",
              email: user ? user.email : null,
              ratedDays: 0,
              totalDays: 10,
              avgRating: 0,
              days: [],
            };
          }

          const avg = parseFloat(
            (
              days.reduce((sum, d) => sum + parseFloat(d.starRating), 0) /
              days.length
            ).toFixed(2)
          );

          return {
            userId: uid,
            userName: user ? `${user.firstName} ${user.lastName}` : "Unknown",
            email: user ? user.email : null,
            ratedDays: days.length,
            totalDays: 10,
            avgRating: avg,
            days: days.map((d) => ({
              dayNo: d.day_no,
              starRating: parseFloat(d.starRating),
              ratingComment: d.ratingComment || null,
            })),
          };
        })
      );

      internBreakdown = internRatings;

      if (internBreakdown.length > 0) {
        internAvgRating = parseFloat(
          (
            internBreakdown.reduce((sum, r) => sum + r.avgRating, 0) /
            internBreakdown.length
          ).toFixed(2)
        );
      }
    }

    // ── Step 3: Fetch manager reviews (peer/cross/manager/leadership) ──
    const whereClause = {
      targetManagerId: managerId,
      isDeleted: false,
    };

    // Optional period filter
    if (periodMonth) whereClause.periodMonth = parseInt(periodMonth);
    if (periodYear) whereClause.periodYear = parseInt(periodYear);

    const managerReviews = await model.ManagerReview.findAll({
      where: whereClause,
      order: [["reviewDate", "DESC"]],
      raw: true,
    });

    // Group by reviewerType
    const groupedByType = {};
    managerReviews.forEach((r) => {
      if (!groupedByType[r.reviewerType]) {
        groupedByType[r.reviewerType] = {
          reviews: [],
          totalCount: 0,
          avgRating: 0,
        };
      }
      groupedByType[r.reviewerType].reviews.push({
        id: r.id,
        reviewerManagerId: r.reviewerManagerId,
        starRating: parseFloat(r.starRating),
        comment: r.comment || null,
        reviewDate: r.reviewDate,
        periodMonth: r.periodMonth,
        periodYear: r.periodYear,
      });
    });

    // Calculate avg per type
    Object.keys(groupedByType).forEach((type) => {
      const reviews = groupedByType[type].reviews;
      groupedByType[type].totalCount = reviews.length;
      groupedByType[type].avgRating = parseFloat(
        (
          reviews.reduce((sum, r) => sum + r.starRating, 0) /
          reviews.length
        ).toFixed(2)
      );
    });

    // ── Step 4: Build overall summary ──
    const reviewTypes = ["peer", "cross", "manager", "leadership"];
    const overallSummary = {};

    reviewTypes.forEach((type) => {
      overallSummary[type] = groupedByType[type]
        ? {
            totalReviews: groupedByType[type].totalCount,
            avgRating: groupedByType[type].avgRating,
          }
        : { totalReviews: 0, avgRating: 0 };
    });

    overallSummary["intern"] = {
      totalInterns: internUserIds.length,
      totalRatedInterns: internBreakdown.filter((i) => i.ratedDays > 0).length,
      avgRating: internAvgRating,
    };

    return ReS(
      res,
      {
        success: true,
        message: "All reviews fetched successfully",
        managerInfo: {
          id: managerRecord.id,
          name: managerRecord.name,
          email: managerRecord.email,
          department: managerRecord.department,
          position: managerRecord.position,
        },
        overallSummary,
        internReviews: {
          totalInterns: internUserIds.length,
          totalRatedInterns: internBreakdown.filter((i) => i.ratedDays > 0).length,
          overallAvgRating: internAvgRating,
          breakdown: internBreakdown,
        },
        managerReviews: {
          totalReviews: managerReviews.length,
          byType: groupedByType,
        },
      },
      200
    );
  } catch (error) {
    console.error("getAllReviews Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getAllReviews = getAllReviews;