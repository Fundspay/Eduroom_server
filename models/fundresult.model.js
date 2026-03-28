"use strict";
module.exports = (sequelize, Sequelize) => {
  const FundResult = sequelize.define(
    "FundResult",
    {
      id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },

      // 🔹 FK — which FundConfig this result belongs to
      configId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unique: true, // one result per config
      },

      // 🔹 Department-wise Breakdown — stored as JSONB
      deptBreakdown: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      // 🔹 Intermediate calculated values
      weightedTotalCoins: {
        type: Sequelize.DECIMAL(15, 4),
        allowNull: false,
        defaultValue: 0,
      },
      retentionMultiplier: {
        type: Sequelize.DECIMAL(8, 4),
        allowNull: false,
        defaultValue: 1,
      },
      coinsAfterRetention: {
        type: Sequelize.DECIMAL(15, 4),
        allowNull: false,
        defaultValue: 0,
      },

      // 🔹 Behavior / 360° rating result
      finalRating: {
        type: Sequelize.DECIMAL(4, 2),
        allowNull: false,
        defaultValue: 0,
      },
      behaviorLevel: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "Bronze",
      },
      behaviorMultiplier: {
        type: Sequelize.DECIMAL(4, 2),
        allowNull: false,
        defaultValue: 1,
      },

      // 🔹 Final outputs
      finalCoins: {
        type: Sequelize.DECIMAL(15, 4),
        allowNull: false,
        defaultValue: 0,
      },
      finalSalary: {
        type: Sequelize.DECIMAL(15, 4),
        allowNull: false,
        defaultValue: 0,
      },
      achievementPercent: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0,
      },

      // 🔹 Performance Category
      performanceCategory: {
        type: Sequelize.ENUM("Gold", "Silver", "Bronze", "Needs Improvement"),
        allowNull: false,
        defaultValue: "Bronze",
      },

      // 🔹 Soft delete
      isDeleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // 🔹 Sequelize Defaults
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
      tableName: "FundResults",
      timestamps: true,
    }
  );

  FundResult.associate = (models) => {
    FundResult.belongsTo(models.FundConfig, {
      foreignKey: "configId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return FundResult;
};