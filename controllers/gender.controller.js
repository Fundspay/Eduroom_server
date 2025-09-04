"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// ✅ Add a new Gender
var add = async function (req, res) {
    let { name } = req.body;
    if (!name) return ReE(res, "Gender name is required", 400);

    try {
        const gender = await model.Gender.create({ name });
        return ReS(res, gender, 201);
    } catch (error) {
        return ReE(res, error.message, 422);
    }
};
module.exports.add = add;

// ✅ Fetch all Genders (active only, excluding soft-deleted)
var fetchAll = async function (req, res) {
    try {
        const genders = await model.Gender.findAll({
            where: { isDeleted: false }
        });
        return ReS(res, { success: true, data: genders }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAll = fetchAll;

// ✅ Fetch a single Gender by ID
var fetchSingle = async function (req, res) {
    try {
        const { id } = req.params;
        if (!id) return ReE(res, "ID is required", 400);

        const gender = await model.Gender.findByPk(id);
        if (!gender) return ReE(res, "Gender not found", 404);

        return ReS(res, gender, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchSingle = fetchSingle;

// ✅ Update a Gender
var updateGender = async function (req, res) {
    try {
        const gender = await model.Gender.findByPk(req.params.id);
        if (!gender) return ReE(res, "Gender not found", 404);

        await gender.update({ name: req.body.name || gender.name });
        return ReS(res, gender, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updateGender = updateGender;

// ✅ Soft delete a Gender
var deleteGender = async function (req, res) {
    try {
        const gender = await model.Gender.findByPk(req.params.id);
        if (!gender) return ReE(res, "Gender not found", 404);

        await gender.update({ isDeleted: true });
        return ReS(res, { message: "Gender deleted successfully" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.deleteGender = deleteGender;
