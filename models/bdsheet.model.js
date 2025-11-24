"use strict";
module.exports = (sequelize, Sequelize) => {
  const BdSheet = sequelize.define(
    "BdSheet",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      // FK → StudentResume
      studentResumeId: { type: Sequelize.BIGINT, allowNull: false },

      // -----------------------------
      // DAY 0 FIELDS
      // -----------------------------
      callStatus: { type: Sequelize.STRING, allowNull: true }, // connected, not connected, not interested
      registration: { type: Sequelize.STRING, allowNull: true }, // completed / not completed
      selectionTest: { type: Sequelize.STRING, allowNull: true }, // % or not completed
      whatsappGroup: { type: Sequelize.STRING, allowNull: true }, // joined / not joined

      // -----------------------------
      // DAY 1 TO DAY 7 (JSON)
      // -----------------------------
      day1: { type: Sequelize.JSON, allowNull: true },
      day2: { type: Sequelize.JSON, allowNull: true },
      day3: { type: Sequelize.JSON, allowNull: true },
      day4: { type: Sequelize.JSON, allowNull: true },
      day5: { type: Sequelize.JSON, allowNull: true },
      day6: { type: Sequelize.JSON, allowNull: true },
      day7: { type: Sequelize.JSON, allowNull: true },

      // JSON FORMAT FOR EACH DAY:
      // {
      //   "date": "2025-01-01",
      //   "sessionAttendance": "achieve | not achieve | not attended | left | terminated",
      //   "businessTask": "text",
      //   "domainTask": "text"
      // }

      // -----------------------------
      // OTHER FIELDS
      // -----------------------------
      category: { 
        type: Sequelize.STRING, 
        allowNull: true 
      }, // Not working, starter, basic, bronze, silver, gold, diamond, platinum

      module2Status: { type: Sequelize.STRING, allowNull: true }, // selected / not selected

      tlAllocated: { type: Sequelize.STRING, allowNull: true }, // TL name

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    { timestamps: true }
  );

  BdSheet.associate = function (models) {
    BdSheet.belongsTo(models.StudentResume, {
      foreignKey: "studentResumeId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

      BdSheet.belongsTo(models.TeamManager, {
      foreignKey: "teamManagerId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  };

  return BdSheet;
};
