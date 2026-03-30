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

      business_task: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: 0,
      },

      day_no: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      work_status: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "Not Completed",
      },

      comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      daily_target: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },

      percent_of_work: {
        type: Sequelize.STRING(10),
        allowNull: true,
        defaultValue: "0.00%",
      },

      category: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      // 🔹 Daily star rating given by intern for their manager (1.0 to 5.0)
      starRating: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true,
        defaultValue: null,
      },

      // 🔹 Rating comment given by intern for that day
      ratingComment: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
      },

      // 🔹 Flag — whether intern has submitted rating for this day
      isRated: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
          fields: ["user_id", "day_no"],
        },
      ],
    }
  );

  return analysis1;
};