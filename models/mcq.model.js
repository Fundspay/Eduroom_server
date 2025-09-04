"use strict";
module.exports = (sequelize, Sequelize) => {
  const MCQ = sequelize.define(
    "MCQ",
    {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      userId: { type: Sequelize.BIGINT, allowNull: false },
      courseId: { type: Sequelize.BIGINT, allowNull: false }, // ✅ link to course
      questionText: { type: Sequelize.TEXT, allowNull: false },
      serialNo: { type: Sequelize.INTEGER, allowNull: false }
    },
    {
      tableName: "MCQs",
      timestamps: true
    }
  );

  MCQ.associate = function (models) {
    MCQ.belongsTo(models.User, { foreignKey: "userId", onDelete: "CASCADE" });
    MCQ.belongsTo(models.Course, { foreignKey: "courseId", onDelete: "CASCADE" });
    MCQ.hasMany(models.MCQAnswer, { foreignKey: "mcqId", onDelete: "CASCADE" });
  };

  return MCQ;
};
