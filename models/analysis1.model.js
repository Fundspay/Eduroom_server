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

      // FIXED TYPE
      business_task: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      },

      day_no: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      work_status: {
        type: Sequelize.TEXT, // 0 = NOT COMPLETED, 1 = COMPLETED, 2 = ON HOLD
        defaultValue: 0
      },

      comment: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      daily_target: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      },

      //  NEW
      percent_of_work: {
        type: Sequelize.STRING(10),
        allowNull: true,
        defaultValue: "0.00%"
      },

      //  NEW
      category: {
        type: Sequelize.STRING(100),
        allowNull: true
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
      indexes: [
        {
          unique: true,
          fields: ["user_id", "day_no"] // REQUIRED FOR UPSERT SAFETY
        }
      ]
    }
  );

  return analysis1;
};
