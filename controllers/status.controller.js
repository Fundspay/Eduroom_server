"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// ✅ Fetch all Statuses (active only, excluding soft-deleted)
var listAll = async function (req, res) {
    try {
        const statuses = await model.Status.findAll({
            where: { isDeleted: false }
        });
        return ReS(res, { success: true, data: statuses }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.listAll = listAll;

// ✅ Update only the teamManager field
var updateStatus = async function (req, res) {
    try {
        const { id } = req.params;
        if (!id) return ReE(res, "ID is required", 400);

        const status = await model.Status.findByPk(id);
        if (!status) return ReE(res, "Status not found", 404);

        if (!req.body.teamManager) {
            return ReE(res, "teamManager field is required", 400);
        }

        await status.update({ teamManager: req.body.teamManager });

        return ReS(res, status, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updateStatus = updateStatus;
