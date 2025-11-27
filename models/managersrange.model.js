"use strict";

module.exports = (sequelize, Sequelize) => {
  const ManagerRanges = sequelize.define(
    "ManagerRanges",
    {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },

      // FK → TeamManager
      teamManagerId: { type: Sequelize.BIGINT, allowNull: false },

      // Incentive and Deduction Amounts
      incentiveAmounts: { type: Sequelize.JSON, allowNull: true },
      deductionAmounts: { type: Sequelize.JSON, allowNull: true },

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
    { timestamps: true }
  );

  ManagerRanges.associate = function (models) {
    // Associate with TeamManager
    ManagerRanges.belongsTo(models.TeamManager, {
      foreignKey: "teamManagerId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return ManagerRanges;
};
