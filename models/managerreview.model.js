"use strict";
module.exports = (sequelize, Sequelize) => {
  const ManagerReview = sequelize.define(
    "ManagerReview",
    {
      id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },

      // 🔹 Who is being reviewed (target manager)
      targetManagerId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },

      // 🔹 Who is giving the review (reviewer manager)
      reviewerManagerId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },

      // 🔹 Type of reviewer
      // intern | peer | cross | manager | leadership
      reviewerType: {
        type: Sequelize.ENUM("intern", "peer", "cross", "manager", "leadership"),
        allowNull: false,
      },

      // 🔹 Star rating (1.0 to 5.0)
      starRating: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
      },

      // 🔹 Optional comment
      comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // 🔹 Date of review (day-based — one review per reviewer per target per day)
      reviewDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      // 🔹 Period tracking (for easy monthly aggregation)
      periodMonth: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      periodYear: {
        type: Sequelize.INTEGER,
        allowNull: false,
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
      tableName: "ManagerReviews",
      timestamps: true,
      indexes: [
        {
          // One review per reviewer per target per day
          unique: true,
          fields: ["targetManagerId", "reviewerManagerId", "reviewerType", "reviewDate"],
          name: "unique_review_per_day",
        },
      ],
    }
  );

  ManagerReview.associate = (models) => {
    // The manager being reviewed
    ManagerReview.belongsTo(models.TeamManager, {
      foreignKey: "targetManagerId",
      as: "targetManager",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

  
    // The manager giving the review
    ManagerReview.belongsTo(models.TeamManager, {
      foreignKey: "reviewerManagerId",
      as: "reviewerManager",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return ManagerReview;
};