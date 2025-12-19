"use strict";
module.exports = (sequelize, Sequelize) => {
  const BdSheet = sequelize.define(
    "BdSheet",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      // FK → StudentResume
      studentResumeId: { type: Sequelize.BIGINT, allowNull: false },

      // ADDED (THIS WAS MISSING)
      teamManagerId: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },

      // -----------------------------
      // NEW BUSINESS TASK COLUMN
      // -----------------------------
      businessTask: { type: Sequelize.STRING, allowNull: true },

      // ⭐ NEW ACTIVE STATUS COLUMN
      activeStatus: {
        type: Sequelize.STRING,
        allowNull: true, // values: "active" or "not active"
      },

      // -----------------------------
      // DAY 0 FIELDS
      // -----------------------------
      callStatus: { type: Sequelize.STRING, allowNull: true },
      registration: { type: Sequelize.STRING, allowNull: true },
      selectionTest: { type: Sequelize.STRING, allowNull: true },
      whatsappGroup: { type: Sequelize.STRING, allowNull: true },
      connectDate: { type: Sequelize.DATE, allowNull: true },
      pushto: { type: Sequelize.STRING, allowNull: true },

      // DAY 1 - DAY 7
      day1: { type: Sequelize.JSON, allowNull: true },
      day2: { type: Sequelize.JSON, allowNull: true },
      day3: { type: Sequelize.JSON, allowNull: true },
      day4: { type: Sequelize.JSON, allowNull: true },
      day5: { type: Sequelize.JSON, allowNull: true },
      day6: { type: Sequelize.JSON, allowNull: true },
      day7: { type: Sequelize.JSON, allowNull: true },

      // CATEGORY
      category: { type: Sequelize.STRING, allowNull: true },

      module2Status: { type: Sequelize.STRING, allowNull: true },
      tlAllocated: { type: Sequelize.STRING, allowNull: true },

      // Dates
      startDate: { type: Sequelize.DATE, allowNull: true },
      endDate: { type: Sequelize.DATE, allowNull: true },

      // ---------------------------------------
      // NEW INCENTIVE & DEDUCTION AMOUNT RANGES
      // ---------------------------------------
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
