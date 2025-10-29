"use strict";
module.exports = (sequelize, Sequelize) => {
  const SelectionDomain = sequelize.define(
    "SelectionDomain",
    {
      id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },

      // same as Domain
      name: { type: Sequelize.TEXT, allowNull: false, unique: true },
      image: { type: Sequelize.STRING, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

      // 👇 userId is optional now
      userId: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onDelete: "SET NULL",
      },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    { timestamps: true }
  );

  return SelectionDomain;
};
