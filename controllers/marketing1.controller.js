"use strict";

const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

// 🔹 Create Marketing Entry
const createMarketing = async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      ratings,
      reviews,
      socialPlatforms,
      posts,
      googleReviews,
      userId
    } = req.body;

    // ✅ Required validation
    if (!name || !email || !phoneNumber) {
      return ReE(res, "name, email and phoneNumber are required", 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phoneNumber.trim();

    // ✅ Followers count logic
    const followersCount = Array.isArray(socialPlatforms)
      ? socialPlatforms.length
      : 0;

    // ✅ Create record
    const marketing = await model.Marketing.create({
      name: name.trim(),
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      ratings: ratings || null,
      reviews: reviews || null,
      socialPlatforms: socialPlatforms || [],
      followersCount,
      posts: posts || 0,
      googleReviews: googleReviews || 0,
      userId: userId || null
    });

    return ReS(
      res,
      { success: true, message: "Marketing data created", data: marketing },
      201
    );
  } catch (error) {
    console.error("Create Marketing Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.createMarketing = createMarketing;

// 🔹 Get All Marketing Data
const fetchAllMarketing = async (req, res) => {
  try {
    const marketingList = await model.Marketing.findAll({
      where: { isDeleted: false },
      order: [["createdAt", "DESC"]],
    });

    return ReS(
      res,
      {
        success: true,
        count: marketingList.length,
        data: marketingList.map((m) => m.get({ plain: true })),
      },
      200
    );
  } catch (error) {
    console.error("Fetch Marketing Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchAllMarketing = fetchAllMarketing;

// 🔹 Get Single Marketing Data
const fetchSingleMarketing = async (req, res) => {
  try {
    const { id } = req.params;

    const marketing = await model.Marketing.findOne({
      where: { id, isDeleted: false },
    });

    if (!marketing) return ReE(res, "Marketing record not found", 404);

    return ReS(
      res,
      { success: true, data: marketing.get({ plain: true }) },
      200
    );
  } catch (error) {
    console.error("Fetch Single Marketing Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.fetchSingleMarketing = fetchSingleMarketing;

// 🔹 Update Marketing Data
const updateMarketing = async (req, res) => {
  try {
    const { id } = req.params;

    const marketing = await model.Marketing.findOne({
      where: { id, isDeleted: false },
    });

    if (!marketing) return ReE(res, "Marketing record not found", 404);

    const {
      name,
      email,
      phoneNumber,
      ratings,
      reviews,
      socialPlatforms,
      posts,
      googleReviews,
    } = req.body;

    // ✅ Followers count recalculation
    const followersCount = Array.isArray(socialPlatforms)
      ? socialPlatforms.length
      : marketing.followersCount;

    await marketing.update({
      name: name ? name.trim() : marketing.name,
      email: email ? email.trim().toLowerCase() : marketing.email,
      phoneNumber: phoneNumber ? phoneNumber.trim() : marketing.phoneNumber,
      ratings: ratings !== undefined ? ratings : marketing.ratings,
      reviews: reviews !== undefined ? reviews : marketing.reviews,
      socialPlatforms: socialPlatforms || marketing.socialPlatforms,
      followersCount,
      posts: posts !== undefined ? posts : marketing.posts,
      googleReviews:
        googleReviews !== undefined
          ? googleReviews
          : marketing.googleReviews,
    });

    return ReS(
      res,
      { success: true, message: "Marketing data updated" },
      200
    );
  } catch (error) {
    console.error("Update Marketing Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.updateMarketing = updateMarketing;

// 🔹 Delete Marketing (Soft Delete)
const deleteMarketing = async (req, res) => {
  try {
    const { id } = req.params;

    const marketing = await model.Marketing.findOne({
      where: { id, isDeleted: false },
    });

    if (!marketing) return ReE(res, "Marketing record not found", 404);

    await marketing.update({ isDeleted: true });

    return ReS(
      res,
      { success: true, message: "Marketing data deleted" },
      200
    );
  } catch (error) {
    console.error("Delete Marketing Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.deleteMarketing = deleteMarketing;