"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// ✅ Fetch all Statuses (active only, excluding soft-deleted)
var listAll = async function (req, res) {
    try {
        const statuses = await model.Status.findAll({
            where: { isDeleted: false }
        });
        const allTeamManagers = await model.TeamManager.findAll({
            where: { isDeleted: false },
            attributes: ["id", "managerId", "name", "email", "mobileNumber", "department", "position", "internshipStatus"]
        });
        return ReS(res, { success: true, data: statuses, teamManagers: allTeamManagers }, 200);
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

        // 📝 Update all fields passed in req.body
        await status.update(req.body);
        await status.reload();

        return ReS(res, status, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updateStatus = updateStatus;