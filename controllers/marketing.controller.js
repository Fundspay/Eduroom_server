"use strict";
const model = require("../models/index");
const bcrypt = require("bcrypt");
const { ReE, ReS } = require("../utils/util.service.js");
const { sendMail } = require("../middleware/mailer.middleware");
const crypto = require("crypto");
const { Op } = require("sequelize");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const CONFIG = require("../config/config.js");
const axios = require("axios");
const moment = require("moment");
const { FundsAudit } = require("../models");
const { User } = require("../models");
const { TeamManager } = require('../models');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require("../config/firebase-service-account.json")
    ),
  });
}

const submitMarketing = async (req, res) => {
  try {
    const {
      id,
      userId,
      name,
      email,
      mobileNumber,
      ratingReviewStatus,
      followers,
      posts,
      googleReviews
    } = req.body;

    if (!userId) {
      return ReE(res, "userId is required", 400);
    }

    const user = await model.User.findOne({
      where: { id: userId, isDeleted: false }
    });

    if (!user) {
      return ReE(res, "User not found", 404);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "followers") && !Array.isArray(followers)) {
      return ReE(res, "followers must be an array", 400);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "posts") && !Array.isArray(posts)) {
      return ReE(res, "posts must be an array", 400);
    }

    if (
      Object.prototype.hasOwnProperty.call(req.body, "ratingReviewStatus") &&
      ratingReviewStatus !== null &&
      ratingReviewStatus !== "completed" &&
      ratingReviewStatus !== "not_completed"
    ) {
      return ReE(res, "ratingReviewStatus must be completed or not_completed", 400);
    }

    if (
      Object.prototype.hasOwnProperty.call(req.body, "googleReviews") &&
      googleReviews !== null &&
      googleReviews !== "completed" &&
      googleReviews !== "not_completed"
    ) {
      return ReE(res, "googleReviews must be completed or not_completed", 400);
    }

    if (id) {
      const marketing = await model.Marketing.findOne({
        where: { id: id, userId: userId, isDeleted: false }
      });

      if (!marketing) {
        return ReE(res, "Marketing record not found", 404);
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "name")) {
        if (!name || !String(name).trim()) {
          return ReE(res, "name is required", 400);
        }
        marketing.name = String(name).trim();
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "email")) {
        marketing.email = email ? String(email).trim().toLowerCase() : null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "mobileNumber")) {
        marketing.mobileNumber = mobileNumber ? String(mobileNumber).trim() : null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "ratingReviewStatus")) {
        marketing.ratingReviewStatus = ratingReviewStatus || null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "followers")) {
        marketing.followers = followers;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "posts")) {
        marketing.posts = posts;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "googleReviews")) {
        marketing.googleReviews = googleReviews || null;
      }

      await marketing.save();

      return ReS(
        res,
        {
          success: true,
          message: "Marketing updated successfully",
          data: marketing
        },
        200
      );
    }

    if (!name || !String(name).trim()) {
      return ReE(res, "name is required", 400);
    }

    const marketing = await model.Marketing.create({
      userId: userId,
      name: String(name).trim(),
      email: Object.prototype.hasOwnProperty.call(req.body, "email")
        ? (email ? String(email).trim().toLowerCase() : null)
        : null,
      mobileNumber: Object.prototype.hasOwnProperty.call(req.body, "mobileNumber")
        ? (mobileNumber ? String(mobileNumber).trim() : null)
        : null,
      ratingReviewStatus: Object.prototype.hasOwnProperty.call(req.body, "ratingReviewStatus")
        ? (ratingReviewStatus || null)
        : null,
      followers: Object.prototype.hasOwnProperty.call(req.body, "followers")
        ? followers
        : [],
      posts: Object.prototype.hasOwnProperty.call(req.body, "posts")
        ? posts
        : [],
      googleReviews: Object.prototype.hasOwnProperty.call(req.body, "googleReviews")
        ? (googleReviews || null)
        : null
    });

    return ReS(
      res,
      {
        success: true,
        message: "Marketing created successfully",
        data: marketing
      },
      201
    );
  } catch (error) {
    console.error("Submit Marketing Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.submitMarketing = submitMarketing;

const fetchMarketingByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return ReE(res, "userId is required", 400);
    }

    const user = await model.User.findOne({
      where: { id: userId, isDeleted: false }
    });

    if (!user) {
      return ReE(res, "User not found", 404);
    }

    const marketingData = await model.Marketing.findAll({
      where: { userId: userId, isDeleted: false },
      order: [["id", "DESC"]]
    });

    const formattedData = marketingData.map((item) => {
      const followersArray = Array.isArray(item.followers) ? item.followers : [];
      const postsArray = Array.isArray(item.posts) ? item.posts : [];

      return {
        id: item.id,
        userId: item.userId,
        name: item.name,
        email: item.email,
        mobileNumber: item.mobileNumber,
        ratingReviewStatus: item.ratingReviewStatus,
        followers: followersArray,
        followersCount: followersArray.length,
        posts: postsArray,
        postsCount: postsArray.length,
        googleReviews: item.googleReviews,
        isVerified: item.isVerified,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      };
    });

    return ReS(
      res,
      {
        success: true,
        userId: Number(userId),
        totalNames: formattedData.length,
        data: formattedData
      },
      200
    );
  } catch (error) {
    console.error("Fetch Marketing By User Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchMarketingByUser = fetchMarketingByUser;

const fetchMarketingSummaryByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return ReE(res, "userId is required", 400);
    }

    const user = await model.User.findOne({
      where: { id: userId, isDeleted: false }
    });

    if (!user) {
      return ReE(res, "User not found", 404);
    }

    const marketingData = await model.Marketing.findAll({
      where: { userId: userId, isDeleted: false }
    });

    let totalFollowersCount = 0;
    let totalPostsCount = 0;
    let totalRatingReviewCompletedCount = 0;
    let totalGoogleReviewsCount = 0;

    marketingData.forEach((item) => {
      const followersArray = Array.isArray(item.followers) ? item.followers : [];
      const postsArray = Array.isArray(item.posts) ? item.posts : [];

      totalFollowersCount += followersArray.length;
      totalPostsCount += postsArray.length;

      if (item.ratingReviewStatus === "completed") {
        totalRatingReviewCompletedCount += 1;
      }

      if (item.googleReviews === "completed") {
        totalGoogleReviewsCount += 1;
      }
    });

    return ReS(
      res,
      {
        success: true,
        userId: Number(userId),
        totalNames: marketingData.length,
        totalFollowersCount: totalFollowersCount,
        totalPostsCount: totalPostsCount,
        totalRatingReviewCompletedCount: totalRatingReviewCompletedCount,
        totalGoogleReviewsCount: totalGoogleReviewsCount
      },
      200
    );
  } catch (error) {
    console.error("Fetch Marketing Summary By User Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchMarketingSummaryByUser = fetchMarketingSummaryByUser;

const deleteMarketing = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return ReE(res, "id is required", 400);
    }

    const marketing = await model.Marketing.findOne({
      where: { id: id, isDeleted: false }
    });

    if (!marketing) {
      return ReE(res, "Marketing record not found", 404);
    }

    marketing.isDeleted = true;
    await marketing.save();

    return ReS(
      res,
      {
        success: true,
        message: "Marketing deleted successfully"
      },
      200
    );
  } catch (error) {
    console.error("Delete Marketing Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.deleteMarketing = deleteMarketing;

const verifyMarketing = async (req, res) => {
  try {
    const { id, userId, isVerified } = req.body;

    if (!id) {
      return ReE(res, "id is required", 400);
    }

    if (!userId) {
      return ReE(res, "userId is required", 400);
    }

    if (!isVerified) {
      return ReE(res, "isVerified is required", 400);
    }

    if (isVerified !== "pending" && isVerified !== "verified") {
      return ReE(res, "isVerified must be pending or verified", 400);
    }

    const user = await model.User.findOne({
      where: { id: userId, isDeleted: false }
    });

    if (!user) {
      return ReE(res, "User not found", 404);
    }

    const marketing = await model.Marketing.findOne({
      where: { id: id, userId: userId, isDeleted: false }
    });

    if (!marketing) {
      return ReE(res, "Marketing record not found", 404);
    }

    marketing.isVerified = isVerified;
    await marketing.save();

    return ReS(
      res,
      {
        success: true,
        message: "Marketing verification status updated successfully",
        data: marketing
      },
      200
    );
  } catch (error) {
    console.error("Verify Marketing Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.verifyMarketing = verifyMarketing;