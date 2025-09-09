"use strict";
const model = require("../models/index");
const bcrypt = require("bcrypt");
const { ReE, ReS } = require("../utils/util.service.js");


// Register Team Manager
var registerTeamManager = async function (req, res) {
    try {
        const { name, email, mobileNumber, department, position, password } = req.body;

        //  Validate required fields
        if (!name || !email || !mobileNumber || !department || !position || !password) {
            return ReE(res, "Required fields missing", 400);
        }

        //  Check duplicates
        const existingManager = await model.TeamManager.findOne({
            where: { email, isDeleted: false }
        });
        if (existingManager) {
            return ReE(res, "Manager with this email already exists", 400);
        }

        //  Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        //  Generate Manager ID (starts from 001)
        const lastManager = await model.TeamManager.findOne({
            order: [["id", "DESC"]],
        });

        let newManagerId;
        if (!lastManager) {
            newManagerId = "001"; // first manager
        } else {
            const lastId = parseInt(lastManager.managerId) || 0;
            newManagerId = String(lastId + 1).padStart(3, "0"); // always 3 digits
        }

        //  Create Team Manager
        const manager = await model.TeamManager.create({
            managerId: newManagerId,
            name,
            email,
            mobileNumber,
            department,
            position,
            password: hashedPassword,
        });

        return ReS(res, { success: true, managerId: manager.managerId }, 201);
    } catch (error) {
        console.error("Error registering manager:", error);
        return ReE(res, error.message, 500);
    }
};
module.exports.registerTeamManager = registerTeamManager;

//  Fetch All Team Managers
var getAllTeamManagers = async function (req, res) {
    try {
        // Fetch all managers
        const managers = await model.TeamManager.findAll({
            where: { isDeleted: false },
            attributes: [
                "managerId",
                "name",
                "email",
                "mobileNumber",
                "department",
                "position",
                "createdAt"
            ],
            order: [["createdAt", "DESC"]],
        });

        // Map over each manager to calculate interns with more than 3 business targets
        const managersWithInternCounts = await Promise.all(
            managers.map(async (manager) => {
                // Count interns under this manager with businessTargets count > 3
                const interns = await model.User.findAll({
                    where: {
                        managerId: manager.managerId,
                        isDeleted: false
                    },
                    attributes: ["businessTargets"]
                });

                let internsWithMoreThanThree = 0;
                interns.forEach((intern) => {
                    const targets = intern.businessTargets || {};
                    if (Object.keys(targets).length > 3) {
                        internsWithMoreThanThree++;
                    }
                });

                return {
                    ...manager.get({ plain: true }),
                    internsWithMoreThanThree
                };
            })
        );

        return ReS(res, { success: true, data: managersWithInternCounts }, 200);
    } catch (error) {
        console.error("Error fetching managers:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.getAllTeamManagers = getAllTeamManagers;
