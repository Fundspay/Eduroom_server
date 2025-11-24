"use strict";
module.exports = (sequelize, Sequelize) => {
  const BdTarget = sequelize.define(
    "BdTarget",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      // Foreign Key to TeamManager
      teamManagerId: { type: Sequelize.BIGINT, allowNull: false },

      // Target date (unique per team manager)
      targetDate: { type: Sequelize.DATEONLY, allowNull: false },

      // 📌 Your required fields
      internsAllocated: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      internsActive: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      accounts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

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

  // Associations
  BdTarget.associate = function (models) {
    BdTarget.belongsTo(models.TeamManager, {
      foreignKey: "teamManagerId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      constraints: true,
    });
  };

  return BdTarget;
};
