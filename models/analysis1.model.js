"use strict";
module.exports = (sequelize, Sequelize) => {
  const analysis1 = sequelize.define(
    "analysis1",
    {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },

      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unique: true
      },

      course_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      course_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      // ✅ FIX: keep JSON (matches DB)
      business_task: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {}
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
      tableName: "user_course_dates",
      timestamps: true,
    }
  );

  return analysis1;
};
