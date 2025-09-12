"use strict";
const model = require("../models/index");
const bcrypt = require("bcrypt");
const { ReE, ReS } = require("../utils/util.service.js");
const { sequelize, User, TeamManager } = require("../models");



// Register Team Manager
var registerTeamManager = async function (req, res) {
    try {
        const { name, email, mobileNumber, department, position, password, internshipStatus } = req.body;

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
            internshipStatus: internshipStatus || null,
        });

        return ReS(res, { success: true, managerId: manager.managerId }, 201);
    } catch (error) {
        console.error("Error registering manager:", error);
        return ReE(res, error.message, 500);
    }
};
module.exports.registerTeamManager = registerTeamManager;


// Get All Team Managers
var getTeamManagers = async function (req, res) {
    try {
        // Fetch all managers that are not deleted
        const managers = await model.TeamManager.findAll({
            where: { isDeleted: false },
            attributes: ['managerId', 'name', 'email', 'mobileNumber', 'department', 'position', 'internshipStatus', 'createdAt']
        });

        return ReS(res, { success: true, managers }, 200);
    } catch (error) {
        console.error("Error fetching managers:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.getTeamManagers = getTeamManagers;


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

// ✅ Update Team Manager
var updateTeamManager = async function (req, res) {
    try {
        const { managerId } = req.params;
        const { name, email, mobileNumber, department, position, password, internshipStatus } = req.body;

        if (!managerId) return ReE(res, "managerId is required", 400);

        // Find manager
        const manager = await model.TeamManager.findOne({
            where: { managerId, isDeleted: false }
        });

        if (!manager) return ReE(res, "Manager not found", 404);

        // Check for duplicate email (if email is being updated)
        if (email && email !== manager.email) {
            const existingManager = await model.TeamManager.findOne({
                where: { email, isDeleted: false }
            });
            if (existingManager) {
                return ReE(res, "Manager with this email already exists", 400);
            }
        }

        // If password provided, hash it
        let hashedPassword = manager.password;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        // Update fields
        await manager.update({
            name: name || manager.name,
            email: email || manager.email,
            mobileNumber: mobileNumber || manager.mobileNumber,
            department: department || manager.department,
            position: position || manager.position,
            password: hashedPassword,
            internshipStatus: internshipStatus ?? manager.internshipStatus
        });

        return ReS(res, { success: true, message: "Manager updated successfully" }, 200);
    } catch (error) {
        console.error("Error updating manager:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.updateTeamManager = updateTeamManager;



const updateManagerAssignment = async (req, res) => {
  const { managerId, internshipStatus } = req.body;

  if (!managerId) return ReE(res, "managerId is required", 400);

  const t = await sequelize.transaction();
  try {
    const manager = await TeamManager.findOne({ where: { managerId }, transaction: t });
    if (!manager) {
      await t.rollback();
      return ReE(res, "Team Manager not found", 404);
    }

    // ✅ Update all users to have this assigned manager
    const users = await User.findAll({ where: { assignedTeamManager: null }, transaction: t });

    for (const user of users) {
      await user.update({ assignedTeamManager: manager.id }, { transaction: t });
    }

    // ✅ Update internship status for the manager if provided
    if (internshipStatus) {
      await manager.update({ internshipStatus }, { transaction: t });
    }

    await t.commit();

    return ReS(res, {
      success: true,
      message: "Assigned team manager updated successfully",
      data: {
        managerId: manager.managerId,
        internshipStatus: manager.internshipStatus,
        assignedUsers: users.map(u => ({
          userId: u.id,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email
        }))
      }
    }, 200);
  } catch (error) {
    await t.rollback();
    console.error("Update Manager Assignment Error:", error);
    return ReE(res, error.message || "Internal Server Error", 500);
  }
};

module.exports.updateManagerAssignment = updateManagerAssignment;
