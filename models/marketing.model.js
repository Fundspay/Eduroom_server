"use strict";
module.exports = (sequelize, Sequelize) => {
  const Marketing = sequelize.define(
    "Marketing",
    {
      id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },

      userId: {
        type: Sequelize.BIGINT,
        allowNull: false
      },

      name: {
        type: Sequelize.STRING,
        allowNull: false
      },

      email: {
        type: Sequelize.STRING,
        allowNull: true
      },

      mobileNumber: {
        type: Sequelize.STRING,
        allowNull: true
      },

      ratingReviewStatus: {
        type: Sequelize.STRING,
        allowNull: true
      },

      followers: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: []
      },

      posts: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: []
      },

      googleReviews: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      },

      isDeleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    {
      timestamps: true,
    }
  );

  Marketing.associate = (models) => {
    Marketing.belongsTo(models.User, {
      foreignKey: "userId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    });
  };

  return Marketing;
};