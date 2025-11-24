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
      callStatus: { type: Sequelize.STRING, allowNull: true }, 
      registration: { type: Sequelize.STRING, allowNull: true }, 
      selectionTest: { type: Sequelize.STRING, allowNull: true }, 
      whatsappGroup: { type: Sequelize.STRING, allowNull: true }, 

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

      // -----------------------------
      // OTHER FIELDS
      // -----------------------------
      category: { 
        type: Sequelize.STRING, 
        allowNull: true 
      },

      module2Status: { type: Sequelize.STRING, allowNull: true }, 
      tlAllocated: { type: Sequelize.STRING, allowNull: true }, 

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    { timestamps: true }
  );

  BdSheet.associate = function (models) {

    // ⭐ CORRECT BD→RESUME LINK
    BdSheet.belongsTo(models.StudentResume, {
      foreignKey: "studentResumeId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    // Existing association (NO CHANGES)
    BdSheet.belongsTo(models.TeamManager, {
      foreignKey: "teamManagerId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  };

  return BdSheet;
};
