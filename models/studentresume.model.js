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
      knowledgeScore: { type: Sequelize.INTEGER, allowNull: true }, // Out of 10
      approachScore: { type: Sequelize.INTEGER, allowNull: true }, // Out of 10
      skillsScore: { type: Sequelize.INTEGER, allowNull: true },   // Out of 10
      otherScore: { type: Sequelize.INTEGER, allowNull: true },    // Out of 10
      totalAverageScore: { type: Sequelize.FLOAT, allowNull: true }, // Calculated average
      finalSelectionStatus: { type: Sequelize.STRING, allowNull: true }, // e.g., "Selected", "Hold", "Not Selected"
      comment: { type: Sequelize.TEXT, allowNull: true },

      // 🔹 Foreign keys
      coSheetId: { type: Sequelize.BIGINT, allowNull: true },
      teamManagerId: { type: Sequelize.BIGINT, allowNull: true }, // replaced userId

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
    // Link to CoSheet
    StudentResume.belongsTo(models.CoSheet, {
      foreignKey: "coSheetId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      constraints: true,
    });

    // 🔹 Link to TeamManager instead of User
    StudentResume.belongsTo(models.TeamManager, {
      foreignKey: "teamManagerId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      constraints: true,
    });
  };

  return StudentResume;
};
