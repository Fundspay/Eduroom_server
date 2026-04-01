"use strict";

module.exports = (sequelize, Sequelize) => {
  const ASheet = sequelize.define(
    "ASheet",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      // 🔹 Business fields
      sr: { type: Sequelize.INTEGER, allowNull: true },
      sourcedFrom: { type: Sequelize.STRING, allowNull: true },
      sourcedBy: { type: Sequelize.STRING, allowNull: true },
      dateOfConnect: { type: Sequelize.DATEONLY, allowNull: true },
      businessName: { type: Sequelize.STRING, allowNull: true },
      contactPersonName: { type: Sequelize.STRING, allowNull: true },
      mobileNumber: { type: Sequelize.STRING, allowNull: true },
      address: { type: Sequelize.STRING, allowNull: true },
      email: { type: Sequelize.STRING, allowNull: true },
      businessSector: { type: Sequelize.STRING, allowNull: true },
      zone: { type: Sequelize.STRING, allowNull: true },
      landmark: { type: Sequelize.STRING, allowNull: true },
      existingWebsite: { type: Sequelize.STRING, allowNull: true },
      smmPresence: { type: Sequelize.STRING, allowNull: true },
      meetingStatus: { type: Sequelize.STRING, allowNull: true },

      // 🔹 C1 to C4 tracking
      dateOfC1Connect: { type: Sequelize.DATEONLY, allowNull: true },
      c1Status: { type: Sequelize.STRING, allowNull: true },
      c1Comment: { type: Sequelize.STRING, allowNull: true },

      dateOfC2Clarity: { type: Sequelize.DATEONLY, allowNull: true },
      c2Status: { type: Sequelize.STRING, allowNull: true },
      c2Comment: { type: Sequelize.STRING, allowNull: true },

      dateOfC3Clarity: { type: Sequelize.DATEONLY, allowNull: true },
      c3Status: { type: Sequelize.STRING, allowNull: true },
      c3Comment: { type: Sequelize.STRING, allowNull: true },

      dateOfC4Customer: { type: Sequelize.DATEONLY, allowNull: true },
      c4Status: { type: Sequelize.STRING, allowNull: true },
      c4Comment: { type: Sequelize.STRING, allowNull: true },

      // 🔹 Foreign key (TeamManager)
      teamManagerId: { type: Sequelize.BIGINT, allowNull: true },

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
  ASheet.associate = function (models) {
    // ASheet belongs to TeamManager
    ASheet.belongsTo(models.TeamManager, {
      foreignKey: "teamManagerId",
      targetKey: "id",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    // ASheet hasOne MSheet
    ASheet.hasOne(models.MSheet, {
      foreignKey: "aSheetId",
      sourceKey: "id",
      as: "MSheet",
    });
  };

  return ASheet;
};