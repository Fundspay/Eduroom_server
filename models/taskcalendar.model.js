"use strict";

module.exports = (sequelize, Sequelize) => {
  const TaskCalendarDay = sequelize.define(
    "TaskCalendarDay",
    {
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT,
      },

      // 🔹 Relation
      teamManagerId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },

      // 🔹 Calendar date (NO time)
      taskDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      // 🔹 Tasks snapshot (JSON array)
      tasks: {
        type: Sequelize.JSONB, // use JSON if MySQL
        allowNull: false,
        defaultValue: [],
      },

      // 🔹 Calculated daily progress snapshot
      dayProgress: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },

      // 🔹 Status flags
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      isDeleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // 🔹 Sequelize defaults
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
      tableName: "TaskCalendarDays",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["teamManagerId", "taskDate"], // VERY IMPORTANT
        },
      ],
    }
  );

  // Association
  TaskCalendarDay.associate = (models) => {
    TaskCalendarDay.belongsTo(models.TeamManager, {
      foreignKey: "teamManagerId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return TaskCalendarDay;
};
