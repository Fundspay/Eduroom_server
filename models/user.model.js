"use strict";
module.exports = (sequelize, Sequelize) => {
  const User = sequelize.define(
    "User",
    {
      id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },

      // 🔹 Student Personal Information
      firstName: { type: Sequelize.STRING, allowNull: false },
      lastName: { type: Sequelize.STRING, allowNull: false },
      fullName: { type: Sequelize.STRING, allowNull: true },
      dateOfBirth: { type: Sequelize.DATEONLY, allowNull: true },
      gender: { type: Sequelize.BIGINT, allowNull: true },

      // 🔹 Contact Info
      phoneNumber: { type: Sequelize.STRING, allowNull: true, unique: true },
      alternatePhoneNumber: { type: Sequelize.STRING, allowNull: true },
      email: { type: Sequelize.STRING, allowNull: true, unique: true },
      residentialAddress: { type: Sequelize.TEXT, allowNull: true },
      emergencyContactName: { type: Sequelize.STRING, allowNull: true },
      emergencyContactNumber: { type: Sequelize.STRING, allowNull: true },
      city: { type: Sequelize.STRING, allowNull: true },
      state: { type: Sequelize.STRING, allowNull: true },
      pinCode: { type: Sequelize.STRING, allowNull: true },

      // 🔹 Educational Details
      collegeName: { type: Sequelize.STRING, allowNull: true },
      collegeRollNumber: { type: Sequelize.STRING, allowNull: true },
      course: { type: Sequelize.STRING, allowNull: true },
      specialization: { type: Sequelize.STRING, allowNull: true },
      currentYear: { type: Sequelize.STRING, allowNull: true },
      currentSemester: { type: Sequelize.STRING, allowNull: true },
      collegeAddress: { type: Sequelize.TEXT, allowNull: true },
      placementCoordinatorName: { type: Sequelize.STRING, allowNull: true },
      placementCoordinatorContact: { type: Sequelize.STRING, allowNull: true },

      // 🔹 Internship Details
      internshipProgram: { type: Sequelize.STRING, allowNull: true },
      internshipDuration: { type: Sequelize.STRING, allowNull: true },
      internshipModeId: { type: Sequelize.BIGINT, allowNull: true },
      preferredStartDate: { type: Sequelize.DATEONLY, allowNull: true },
      referralCode: { type: Sequelize.STRING, allowNull: true },
      referralLink: { type: Sequelize.STRING, allowNull: true },
      referralSource: { type: Sequelize.STRING, allowNull: true },

      // 🔹 Verification
      studentIdCard: { type: Sequelize.STRING, allowNull: true },
      governmentIdProof: { type: Sequelize.STRING, allowNull: true },
      passportPhoto: { type: Sequelize.STRING, allowNull: true },

      // 🔹 Bank / Payment
      accountHolderName: { type: Sequelize.STRING, allowNull: true },
      bankName: { type: Sequelize.STRING, allowNull: true },
      branchAddress: { type: Sequelize.STRING, allowNull: true },
      ifscCode: { type: Sequelize.STRING, allowNull: true },
      accountNumber: { type: Sequelize.STRING, allowNull: true },

      // 🔹 Communication
      preferredCommunicationId: { type: Sequelize.BIGINT, allowNull: true },
      linkedInProfile: { type: Sequelize.STRING, allowNull: true },

      // 🔹 Consent / Declaration
      studentDeclaration: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      consentAgreement: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      businessTargets: { type: Sequelize.JSON, allowNull: true, defaultValue: {} },

      // 🔹 Subscription Wallet
      subscriptionWallet: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      subscriptiondeductedWallet: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      subscriptionLeft: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },

      // 🔹 Course Tracking
      courseDates: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {}
      },
      courseStatuses: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {}
      },
      triggeredTargets: {
         type: Sequelize.JSON, // or DataTypes.JSON if MySQL
        allowNull: true,
        defaultValue: {}

      },

      // 🔹 Auth & System
      password: { type: Sequelize.STRING, allowNull: false },
      resetToken: { type: Sequelize.STRING, allowNull: true },
      resetTokenExpiry: { type: Sequelize.DATE, allowNull: true },

      // 🔹 Team Manager
      assignedTeamManager: {
        type: Sequelize.BIGINT,
        allowNull: true
      },

      lastLoginAt: { type: Sequelize.DATE, allowNull: true },
      lastLogoutAt: { type: Sequelize.DATE, allowNull: true },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

      // 🔹 Sequelize Defaults
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    {
      tableName: "Users",
      timestamps: true,
    }
  );

  // ✅ Associations
  User.associate = (models) => {
    User.belongsTo(models.Gender, { foreignKey: "gender", onDelete: "RESTRICT", onUpdate: "RESTRICT" });
    User.belongsTo(models.CommunicationMode, { foreignKey: "preferredCommunicationId", onDelete: "RESTRICT", onUpdate: "RESTRICT" });
    User.belongsTo(models.InternshipMode, { foreignKey: "internshipModeId", onDelete: "RESTRICT", onUpdate: "RESTRICT" });
    User.hasMany(models.Status, { foreignKey: "userId", onDelete: "RESTRICT", onUpdate: "RESTRICT" });
    User.belongsTo(models.TeamManager, {
      foreignKey: "assignedTeamManager",
      targetKey: "id",
      as: "teamManager",
      onDelete: "SET NULL",
      onUpdate: "CASCADE"
    });
    User.hasMany(models.OfferLetter, {
      foreignKey: "userId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    });
    User.hasMany(models.InternshipCertificate, {
      foreignKey: "userId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    });
    User.hasMany(models.FundsAudit, {
        foreignKey: "userId",
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
    });

  };

  return User;
};
