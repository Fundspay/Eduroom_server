"use strict";
module.exports = (sequelize, Sequelize) => {
  const ScoreSheet = sequelize.define(
    "ScoreSheet",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      session: { type: Sequelize.STRING, allowNull: true },
      department: { type: Sequelize.STRING, allowNull: true },
      link: { type: Sequelize.TEXT, allowNull: true },
      portfoliolink: { type: Sequelize.TEXT, allowNull: true },
      videolink: { type: Sequelize.TEXT, allowNull: true },
      comment: { type: Sequelize.TEXT, allowNull: true },

      // 🔹 Manager reference (ID)
      manager: { type: Sequelize.BIGINT, allowNull: true },

      // 🔹 Manager name (DENORMALIZED for frontend use)
      managerName: { type: Sequelize.STRING, allowNull: true },

      score1: { type: Sequelize.INTEGER, allowNull: true },
      score2: { type: Sequelize.INTEGER, allowNull: true },
      score3: { type: Sequelize.INTEGER, allowNull: true },
      totalscore: { type: Sequelize.INTEGER, allowNull: true },

      // 🔹 NEW COLUMNS
      startdate: { type: Sequelize.DATEONLY, allowNull: true },
      enddate: { type: Sequelize.DATEONLY, allowNull: true },
      daysremaining: { type: Sequelize.INTEGER, allowNull: true },
      startdate1: { type: Sequelize.DATEONLY, allowNull: true },
      enddate1: { type: Sequelize.DATEONLY, allowNull: true },
      daysremaining1: { type: Sequelize.INTEGER, allowNull: true },

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

  // 🔹 Association (same style as reference)
  ScoreSheet.associate = function (models) {
    ScoreSheet.belongsTo(models.TeamManager, {
      foreignKey: "manager",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      constraints: true,
    });
  };

  return ScoreSheet;
};
