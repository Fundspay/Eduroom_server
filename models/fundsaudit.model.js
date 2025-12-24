"use strict";

module.exports = (sequelize, Sequelize) => {
  const FundsAudit = sequelize.define(
    "FundsAudit",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      userId: { type: Sequelize.BIGINT, allowNull: false }, // the userId from the request
      registeredUserId: { type: Sequelize.STRING, allowNull: false }, // the user_id from registered_users
      firstName: { type: Sequelize.STRING, allowNull: true },
      lastName: { type: Sequelize.STRING, allowNull: true },
      phoneNumber: { type: Sequelize.STRING, allowNull: true },
      email: { type: Sequelize.STRING, allowNull: true },
      dateOfPayment: { type: Sequelize.DATE, allowNull: true },
      dateOfDownload: { type: Sequelize.DATE, allowNull: true },
      hasPaid: { type: Sequelize.BOOLEAN, allowNull: true },
      isDownloaded: { type: Sequelize.BOOLEAN, allowNull: true },
      queryStatus: { type: Sequelize.STRING, allowNull: true },
      isQueryRaised: { type: Sequelize.BOOLEAN, allowNull: true },
      occupation: { type: Sequelize.STRING, allowNull: true },
      managerReview: { type: Sequelize.STRING, allowNull: true, defaultValue: "not completed" },
      userReview: { type: Sequelize.STRING, allowNull: true, defaultValue: "not completed" },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    },
    { timestamps: true }
  );

  FundsAudit.associate = function (models) {
    // Link to the main User who owns this referral
    FundsAudit.belongsTo(models.User, { foreignKey: "userId", onDelete: "CASCADE", onUpdate: "CASCADE" });
  };

  return FundsAudit;
};
