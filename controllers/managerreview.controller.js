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
      include: [
        {
          model: model.TeamManager,
          as: "targetManager",
          attributes: ["id", "name"], // change "name" if your column is different
        },
        {
          model: model.TeamManager,
          as: "reviewerManager",
          attributes: ["id", "name"],
        },
      ],
      order: [["reviewDate", "DESC"]],
    });

    const formattedReviews = reviews.map((r) => ({
      ...r.dataValues,
      starRating: parseFloat(r.starRating),
      targetManagerName: r.targetManager ? r.targetManager.name : null,
      reviewerManagerName: r.reviewerManager ? r.reviewerManager.name : null,
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