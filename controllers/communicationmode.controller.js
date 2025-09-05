"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// ✅ Add CommunicationMode
var add = async function (req, res) {
    let { name } = req.body;
    if (!name) return ReE(res, "CommunicationMode name is required", 400);

    try {
        const comm = await model.CommunicationMode.create({ name });
        return ReS(res, comm, 201);
    } catch (error) {
        return ReE(res, error.message, 422);
    }
};
module.exports.add = add;

// ✅ Fetch all
var fetchAll = async function (req, res) {
    try {
        const comms = await model.CommunicationMode.findAll({
            where: { isDeleted: false }
        });
        return ReS(res, { success: true, data: comms }, 200);
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

        const comm = await model.CommunicationMode.findByPk(id);
        if (!comm) return ReE(res, "CommunicationMode not found", 404);

        return ReS(res, comm, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchSingle = fetchSingle;

// ✅ Update
var updateComm = async function (req, res) {
    try {
        const comm = await model.CommunicationMode.findByPk(req.params.id);
        if (!comm) return ReE(res, "CommunicationMode not found", 404);

        await comm.update({ name: req.body.name || comm.name });
        return ReS(res, comm, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updateComm = updateComm;

// ✅ Soft delete
var deleteComm = async function (req, res) {
    try {
        const comm = await model.CommunicationMode.findByPk(req.params.id);
        if (!comm) return ReE(res, "CommunicationMode not found", 404);

        await comm.update({ isDeleted: true });
        return ReS(res, { message: "CommunicationMode deleted successfully" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.deleteComm = deleteComm;
