"use strict";
module.exports = (sequelize, Sequelize) => {
  const MCQ = sequelize.define(
    "MCQ",
    {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      userId: { type: Sequelize.BIGINT, allowNull: false },
      courseId: { type: Sequelize.BIGINT, allowNull: false },
      domainId: { type: Sequelize.BIGINT, allowNull: false },
      domainTypeId: { type: Sequelize.BIGINT, allowNull: true },
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
    MCQ.belongsTo(models.Domain, { foreignKey: "domainId", onDelete: "CASCADE" });
    MCQ.belongsTo(models.DomainType, { foreignKey: "domainTypeId", onDelete: "SET NULL" });
  };

  return MCQ;
};
