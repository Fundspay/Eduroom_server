"use strict";
module.exports = (sequelize, Sequelize) => {
    const TeamManager = sequelize.define(
        "TeamManager",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },

            // 🔹 Manager Basic Info
            managerId: { type: Sequelize.STRING, allowNull: false, unique: true }, // Auto-generated at registration
            name: { type: Sequelize.STRING, allowNull: false },
            email: { type: Sequelize.STRING, allowNull: false, unique: true },
            mobileNumber: { type: Sequelize.STRING, allowNull: false, unique: true },

            // 🔹 Work Info
            department: { type: Sequelize.STRING, allowNull: false }, // hardcoded values, no enums
            position: { type: Sequelize.STRING, allowNull: false },
            internshipStatus: { type: Sequelize.STRING, allowNull: true},   // hardcoded values, no enums

            // 🔹 Auth & System
            password: { type: Sequelize.STRING, allowNull: false },
            lastLoginAt: { type: Sequelize.DATE, allowNull: true },
            lastLogoutAt: { type: Sequelize.DATE, allowNull: true },
            isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

            // 🔹 Sequelize Defaults
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        {
            tableName: "TeamManagers",
            timestamps: true,
        }
    );

    //  Associations (optional, if in future needed)
    TeamManager.associate = (models) => {
        // Example: if TeamManager manages Users
        // TeamManager.hasMany(models.User, {
        //     foreignKey: "managerId",
        //     onDelete: "SET NULL",
        //     onUpdate: "CASCADE",
        //     constraints: true,
        // });
    };

    return TeamManager;
};
