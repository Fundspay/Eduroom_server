"use strict";
module.exports = (sequelize, Sequelize) => {
  const MCQAnswer = sequelize.define(
    "MCQAnswer",
    {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      userId: { type: Sequelize.BIGINT, allowNull: false },
      courseId: { type: Sequelize.BIGINT, allowNull: false }, // ✅ direct link to course
      mcqId: { type: Sequelize.BIGINT, allowNull: false },    // ✅ link to MCQ
      answerText: { type: Sequelize.TEXT, allowNull: false },
      isCorrect: { type: Sequelize.BOOLEAN, defaultValue: false }
    },
    {
      tableName: "MCQAnswers",
      timestamps: true
    }
  );

  MCQAnswer.associate = function (models) {
    MCQAnswer.belongsTo(models.User, { foreignKey: "userId", onDelete: "CASCADE" });
    MCQAnswer.belongsTo(models.Course, { foreignKey: "courseId", onDelete: "CASCADE" });
    MCQAnswer.belongsTo(models.MCQ, { foreignKey: "mcqId", onDelete: "CASCADE" });
  };

  return MCQAnswer;
};
