"use strict";
module.exports = (sequelize, Sequelize) => {
  const FundConfig = sequelize.define(
    "FundConfig",
    {
      id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },

      // 🔹 FK — which TeamManager created this config
      managerId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },

      // 🔹 Employee Basic Info (the employee being evaluated)
      employeeName: { type: Sequelize.STRING, allowNull: false },
      employeeEmail: { type: Sequelize.STRING, allowNull: true },
      position: { type: Sequelize.STRING, allowNull: false },
      targetCoins: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },

      // 🔹 Departments — stored as JSONB array
      // Structure: [{ key, name, icon, weight, metrics: [{ name, multiplier, weight, source }] }]
      departments: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      // 🔹 360° Ratings — stored as JSONB array
      // Structure: [{ key, name, weight, value }]
      ratings: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      // 🔹 Retention
      retentionRate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },

      // 🔹 Evaluation period (optional but useful)
      periodMonth: { type: Sequelize.INTEGER, allowNull: true }, // 1–12
      periodYear: { type: Sequelize.INTEGER, allowNull: true },

      // 🔹 Soft delete
      isDeleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // 🔹 Sequelize Defaults
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    },
    {
      tableName: "FundConfigs",
      timestamps: true,
    }
  );

  FundConfig.associate = (models) => {
    // Many configs can be created by one TeamManager
    FundConfig.belongsTo(models.TeamManager, {
      foreignKey: "managerId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    // Each config has one calculated result
    FundConfig.hasOne(models.FundResult, {
      foreignKey: "configId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return FundConfig;
};