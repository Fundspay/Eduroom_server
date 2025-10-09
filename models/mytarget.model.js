"use strict";
module.exports = (sequelize, Sequelize) => {
  const MyTarget = sequelize.define(
    "MyTarget",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      // 🔹 Foreign Key to TeamManager instead of User
      teamManagerId: { type: Sequelize.BIGINT, allowNull: false },

      // Target date (unique per team manager)
      targetDate: { type: Sequelize.DATEONLY, allowNull: false },

      jds: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      calls: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      followUps: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      resumetarget: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

      // New fields
      collegeTarget: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      interviewsTarget: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      resumesReceivedTarget: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    {
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["teamManagerId", "targetDate"], // unique per team manager per day
        },
      ],
    }
  );

  // 🔹 Associations
  MyTarget.associate = function (models) {
    // Belongs to TeamManager
    MyTarget.belongsTo(models.TeamManager, {
      foreignKey: "teamManagerId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      constraints: true,
    });

    // (Optional) If you want to restore CoSheet relation later:
    // MyTarget.belongsTo(models.CoSheet, {
    //   foreignKey: "coSheetId",
    //   onDelete: "CASCADE",
    //   onUpdate: "CASCADE",
    //   constraints: true,
    // });
  };

  return MyTarget;
};
