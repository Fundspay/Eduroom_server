"use strict";

module.exports = (sequelize, Sequelize) => {
  const UserCourseCompletion = sequelize.define(
    "UserCourseCompletion",
    {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      userId: { type: Sequelize.BIGINT, allowNull: false },
      courseId: { type: Sequelize.BIGINT, allowNull: false },
      mcqScore: { type: Sequelize.FLOAT, allowNull: true },        // Score from MCQs
      caseStudyScore: { type: Sequelize.FLOAT, allowNull: true },  // Score from Case Studies
      percentage: { type: Sequelize.FLOAT, allowNull: true },      // Overall percentage
      certificateSent: { type: Sequelize.BOOLEAN, defaultValue: false },
      completionDate: { type: Sequelize.DATE, allowNull: true }
    },
    {
      tableName: "UserCourseCompletions",
      timestamps: true
    }
  );

  UserCourseCompletion.associate = (models) => {
    UserCourseCompletion.belongsTo(models.User, { foreignKey: "userId", onDelete: "CASCADE" });
    UserCourseCompletion.belongsTo(models.Course, { foreignKey: "courseId", onDelete: "CASCADE" });
  };

  return UserCourseCompletion;
};
