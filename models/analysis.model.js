"use strict";
module.exports = (sequelize, Sequelize) => {
  const Analysis = sequelize.define(
    "Analysis",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      day: { type: Sequelize.STRING, allowNull: false },

      // 🔹 Replace userId with teamManagerId
      teamManagerId: { type: Sequelize.BIGINT, allowNull: false },

      myTargetId: { type: Sequelize.BIGINT, allowNull: true }, // optional connection to MyTarget
      jdSentCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      callsCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    { timestamps: true }
  );

  // 🔹 Updated associations
  Analysis.associate = function (models) {
    // Each Analysis belongs to a TeamManager
    Analysis.belongsTo(models.TeamManager, {
      foreignKey: "teamManagerId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      constraints: true,
    });

    // Still linked to MyTarget
    Analysis.belongsTo(models.MyTarget, {
      foreignKey: "myTargetId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      constraints: true,
    });
  };

  return Analysis;
};
