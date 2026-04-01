"use strict";
module.exports = (sequelize, Sequelize) => {
  const MSheet = sequelize.define(
    "MSheet",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      // 🔹 Foreign Keys
      aSheetId: { type: Sequelize.BIGINT, allowNull: true },

      // 🔹 RM Assigned Info
      rmAssignedName: { type: Sequelize.STRING, allowNull: true },
      rmAssignedContact: { type: Sequelize.STRING, allowNull: true },

      // 🔹 Domain / Website Info
      domainName: { type: Sequelize.STRING, allowNull: true },
      websiteStartDate: { type: Sequelize.DATEONLY, allowNull: true },
      websiteCompletionDate: { type: Sequelize.DATEONLY, allowNull: true },

      // 🔹 User-Provided Data
      trainingAndHandoverStatus: { type: Sequelize.STRING, allowNull: true },
      servicesOpted: { type: Sequelize.STRING, allowNull: true },
      clientFeedback: { type: Sequelize.TEXT, allowNull: true },
      renewalDate: { type: Sequelize.DATEONLY, allowNull: true },
      renewalStatus: { type: Sequelize.STRING, allowNull: true },

      // 🔹 System fields
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
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
      timestamps: true,
    }
  );

  // 🔹 Associations
  MSheet.associate = function (models) {
    MSheet.belongsTo(models.ASheet, {
      foreignKey: "aSheetId", // this column exists in MSheet
      targetKey: "id", // this column exists in ASheet
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  };

  return MSheet;
};
