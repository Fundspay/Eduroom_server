"use strict";
module.exports = (sequelize, Sequelize) => {
  const StudentResume = sequelize.define(
    "StudentResume",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      // SR (serial no.)
      sr: { type: Sequelize.INTEGER, allowNull: true },

      // Resume details
      resumeDate: { type: Sequelize.DATE, allowNull: true },
      collegeName: { type: Sequelize.STRING, allowNull: true },
      course: { type: Sequelize.STRING, allowNull: true },
      internshipType: { type: Sequelize.STRING, allowNull: true },

      // Who followed up with the college
      followupBy: { type: Sequelize.STRING, allowNull: true },

      // Student details
      studentName: { type: Sequelize.STRING, allowNull: true },
      mobileNumber: { type: Sequelize.STRING, allowNull: true },
      emailId: { type: Sequelize.STRING, allowNull: true },
      domain: { type: Sequelize.STRING, allowNull: true },

      // Interview details
      interviewDate: { type: Sequelize.DATE, allowNull: true },
      interviewTime: { type: Sequelize.TIME, allowNull: true },

      // Interview Score Card fields
      interviewedBy: { type: Sequelize.STRING, allowNull: true },
      knowledgeScore: { type: Sequelize.INTEGER, allowNull: true },
      approachScore: { type: Sequelize.INTEGER, allowNull: true },
      skillsScore: { type: Sequelize.INTEGER, allowNull: true },
      otherScore: { type: Sequelize.INTEGER, allowNull: true },
      totalAverageScore: { type: Sequelize.FLOAT, allowNull: true },
      finalSelectionStatus: { type: Sequelize.STRING, allowNull: true },
      comment: { type: Sequelize.TEXT, allowNull: true },

      // NEW FIELDS ADDED (as requested)
      callStatus: { type: Sequelize.STRING, allowNull: true }, // answered / not answered / switch off
      alloted: { type: Sequelize.STRING, allowNull: true },    // registered users

      // 🔹 Foreign keys
      coSheetId: { type: Sequelize.BIGINT, allowNull: true },
      teamManagerId: { type: Sequelize.BIGINT, allowNull: true },

      Dateofonboarding: { type: Sequelize.DATE, allowNull: true },
      mailSentAt: { type: Sequelize.DATE, allowNull: true },
      isRegistered: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      dateOfRegistration: { type: Sequelize.DATE, allowNull: true },

      // Status fields
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    { timestamps: true }
  );

  // 🔹 Associations
  StudentResume.associate = function (models) {
    StudentResume.belongsTo(models.CoSheet, {
      foreignKey: "coSheetId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    StudentResume.belongsTo(models.TeamManager, {
      foreignKey: "teamManagerId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    StudentResume.belongsTo(models.User, {
      foreignKey: "mobileNumber",
      targetKey: "phoneNumber",
      as: "user",
      constraints: false,
    });

    StudentResume.hasMany(models.FundsAuditStudent, {
      foreignKey: "studentResumeId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return StudentResume;
};
