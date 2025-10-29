"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { uploadGeneralFile } = require("../middleware/s3.middleware.js"); // Adjust path if needed

// Add a new Selection Domain with image upload
var addSelectionDomain = async (req, res) => {
    uploadGeneralFile.single("image")(req, res, async function (err) {
        if (err) return ReE(res, err.message, 422);

        const { name, description, userId } = req.body;
        if (!name) return ReE(res, "Selection domain name is required", 400);

        try {
            const selectionDomain = await model.SelectionDomain.create({
                name,
                description: description || null,
                image: req.file ? req.file.location : null, // S3 URL if uploaded
                userId: userId || null,
            });
            return ReS(res, selectionDomain, 201);
        } catch (error) {
            return ReE(res, error.message, 422);
        }
    });
};
module.exports.addSelectionDomain = addSelectionDomain;

var updateSelectionDomain = async (req, res) => {
    uploadGeneralFile.single("image")(req, res, async function (err) {
        if (err) return ReE(res, err.message, 422);

        try {
            console.log("🔹 req.body:", req.body);
            console.log("🔹 req.file:", req.file);

            const { id } = req.params;
            const selectionDomain = await model.SelectionDomain.findByPk(id);

            if (!selectionDomain) {
                return ReE(res, "Selection domain not found", 404);
            }

            // if req.body is undefined, handle gracefully
            if (!req.body) {
                return ReE(res, "Request body missing — make sure you send form-data", 400);
            }

            const updatedFields = {};

            if (req.body.name) updatedFields.name = req.body.name;
            if (req.body.description)
                updatedFields.description = req.body.description;
            if (req.file && req.file.location)
                updatedFields.image = req.file.location;

            if (Object.keys(updatedFields).length === 0) {
                return ReE(res, "No fields to update", 400);
            }

            await selectionDomain.update(updatedFields);

            return ReS(res, {
                message: "Selection domain updated successfully",
                data: selectionDomain,
            }, 200);
        } catch (error) {
            console.error("Error updating selection domain:", error);
            return ReE(res, error.message, 500);
        }
    });
};

module.exports.updateSelectionDomain = updateSelectionDomain;

//  Fetch all Selection Domains
var fetchAllSelectionDomains = async (req, res) => {
    try {
        const selectionDomains = await model.SelectionDomain.findAll();
        return ReS(res, { success: true, data: selectionDomains }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAllSelectionDomains = fetchAllSelectionDomains;


// Fetch single Selection Domain by ID
var fetchSingleSelectionDomain = async (req, res) => {
    const { id } = req.params;
    if (!id) return ReE(res, "Selection domain ID is required", 400);

    try {
        const selectionDomain = await model.SelectionDomain.findByPk(id);
        if (!selectionDomain) return ReE(res, "Selection domain not found", 404);
        return ReS(res, selectionDomain, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchSingleSelectionDomain = fetchSingleSelectionDomain;


//  Hard delete Selection Domain
var deleteSelectionDomain = async (req, res) => {
    try {
        const selectionDomain = await model.SelectionDomain.findByPk(req.params.id);
        if (!selectionDomain) return ReE(res, "Selection domain not found", 404);

        await selectionDomain.destroy(); // ⬅️ permanently removes the record
        return ReS(res, { message: "Selection domain deleted successfully" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.deleteSelectionDomain = deleteSelectionDomain;
