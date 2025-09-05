"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// ✅ Add InternshipMode
var add = async function (req, res) {
    let { name } = req.body;
    if (!name) return ReE(res, "InternshipMode name is required", 400);

    try {
        const mode = await model.InternshipMode.create({ name });
        return ReS(res, mode, 201);
    } catch (error) {
        return ReE(res, error.message, 422);
    }
};
module.exports.add = add;

// ✅ Fetch all
var fetchAll = async function (req, res) {
    try {
        const modes = await model.InternshipMode.findAll({
            where: { isDeleted: false }
        });
        return ReS(res, { success: true, data: modes }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAll = fetchAll;

// ✅ Fetch single
var fetchSingle = async function (req, res) {
    try {
        const { id } = req.params;
        if (!id) return ReE(res, "ID is required", 400);

        const mode = await model.InternshipMode.findByPk(id);
        if (!mode) return ReE(res, "InternshipMode not found", 404);

        return ReS(res, mode, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchSingle = fetchSingle;

// ✅ Update
var updateMode = async function (req, res) {
    try {
        const mode = await model.InternshipMode.findByPk(req.params.id);
        if (!mode) return ReE(res, "InternshipMode not found", 404);

        await mode.update({ name: req.body.name || mode.name });
        return ReS(res, mode, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updateMode = updateMode;

// ✅ Soft delete
var deleteMode = async function (req, res) {
    try {
        const mode = await model.InternshipMode.findByPk(req.params.id);
        if (!mode) return ReE(res, "InternshipMode not found", 404);

        await mode.update({ isDeleted: true });
        return ReS(res, { message: "InternshipMode deleted successfully" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.deleteMode = deleteMode;
