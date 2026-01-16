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
    // Fetch all active managers (not deleted)
    const managers = await model.TeamManager.findAll({
      where: { isDeleted: false },
      attributes: [
        "id",          // internal DB id
        "managerId",   // manager unique identifier
        "name",
        "email",
        "mobileNumber",
        "department",
        "position",
        "internshipStatus"
      ],
      order: [["name", "ASC"]] // optional: sort by name
    });

    return ReS(res, { success: true, managers }, 200);
  } catch (error) {
    console.error("Error fetching managers:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getTeamManagers = getTeamManagers;


// Fetch All Team Managers
const getAllTeamManagers = async (req, res) => {
  try {
    // Fetch all managers from the DB (not deleted)
    const managers = await model.TeamManager.findAll({
      where: { isDeleted: false },
      attributes: ["id", "name", "email", "mobileNumber", "department", "position", "createdAt"],
      order: [["createdAt", "DESC"]],
      raw: true,
    });

    // Map them into a simple list (optional, you can just return managers as-is)
    const managerList = managers.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      mobileNumber: m.mobileNumber,
      department: m.department,
      position: m.position,
      createdAt: m.createdAt,
    }));

    return ReS(res, { success: true, data: managerList }, 200);
  } catch (error) {
    console.error("Error fetching managers:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getAllTeamManagers = getAllTeamManagers;


var updateTeamManager = async function (req, res) {
    try {
        const { managerId } = req.params;
        const { name, email, mobileNumber, department, position, password, internshipStatus } = req.body;

        if (!managerId) return ReE(res, "managerId is required", 400);

        // Find manager (FIXED: using primary key `id`)
        const manager = await model.TeamManager.findOne({
            where: { id: managerId, isDeleted: false }
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
