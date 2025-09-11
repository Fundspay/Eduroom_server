"use strict";
module.exports = (sequelize, Sequelize) => {
  const TeamManager = sequelize.define(
    "TeamManager",
    {
      id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },

      // 🔹 Manager Basic Info
      managerId: { type: Sequelize.STRING, allowNull: false, unique: true },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      mobileNumber: { type: Sequelize.STRING, allowNull: false, unique: true },

      // 🔹 Work Info
      department: { type: Sequelize.STRING, allowNull: false },
      position: { type: Sequelize.STRING, allowNull: false },
      internshipStatus: { type: Sequelize.STRING, allowNull: true },

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

  TeamManager.associate = (models) => {
    TeamManager.hasMany(models.User, {
      foreignKey: "assignedTeamManager",
      as: "users",
      onDelete: "SET NULL",
      onUpdate: "CASCADE"
    });
  };

  return TeamManager;
};
