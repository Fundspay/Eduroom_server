"use strict";

module.exports = (sequelize, Sequelize) => {
  const MyTarget1 = sequelize.define(
    "MyTarget1",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      // 🔹 Foreign key (TeamManager instead of User)
      teamManagerId: { type: Sequelize.BIGINT, allowNull: false },

      targetDate: { type: Sequelize.DATEONLY, allowNull: false },
      c1Target: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      c2Target: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      c3Target: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      c4Target: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      subscriptionTarget: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      token: { type: Sequelize.STRING, allowNull: true },

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
      indexes: [
        {
          unique: true,
          fields: ["teamManagerId", "targetDate"], // ✅ updated unique constraint
        },
      ],
    }
  );

  // 🔹 Associations (one-side only)
  MyTarget1.associate = function (models) {
    MyTarget1.belongsTo(models.TeamManager, {
      foreignKey: "teamManagerId",
      targetKey: "id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      constraints: true,
    });
  };

  return MyTarget1;
};