"use strict";

module.exports = (sequelize, Sequelize) => {
  const FundsAuditStudent = sequelize.define(
    "FundsAuditStudent",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      studentResumeId: { type: Sequelize.BIGINT, allowNull: false },
      userId: { type: Sequelize.BIGINT, allowNull: false },
      fundsAuditId: { type: Sequelize.BIGINT, allowNull: false },
      registeredUserId: { type: Sequelize.STRING, allowNull: true },
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
      teamManager: { type: Sequelize.STRING, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    { timestamps: true }
  );

  // ---------------------------
  // Associations without aliases
  // ---------------------------
  FundsAuditStudent.associate = (models) => {
    // Link to StudentResume
    FundsAuditStudent.belongsTo(models.StudentResume, {
      foreignKey: "studentResumeId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    // Link to User
    FundsAuditStudent.belongsTo(models.User, {
      foreignKey: "userId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    // Link to original FundsAudit entry
    FundsAuditStudent.belongsTo(models.FundsAudit, {
      foreignKey: "fundsAuditId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  };

  return FundsAuditStudent;
};
