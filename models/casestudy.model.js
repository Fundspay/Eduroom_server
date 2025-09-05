"use strict";
module.exports = (sequelize, Sequelize) => {
  const CaseStudy = sequelize.define(
    "CaseStudy",
    {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      userId: { type: Sequelize.BIGINT, allowNull: false },
      courseId: { type: Sequelize.BIGINT, allowNull: false },
      domainId: { type: Sequelize.BIGINT, allowNull: false },
      domainTypeId: { type: Sequelize.BIGINT, allowNull: true },
      problemStatement: { type: Sequelize.TEXT, allowNull: false },
      answerKeywords: { type: Sequelize.TEXT, allowNull: true },
      result: { type: Sequelize.TEXT, allowNull: true }
    },
    {
      tableName: "CaseStudies",
      timestamps: true
    }
  );

  CaseStudy.associate = function (models) {
    CaseStudy.belongsTo(models.User, { foreignKey: "userId", onDelete: "CASCADE" });
    CaseStudy.belongsTo(models.Course, { foreignKey: "courseId", onDelete: "CASCADE" });
    CaseStudy.belongsTo(models.Domain, { foreignKey: "domainId", onDelete: "CASCADE" });
    CaseStudy.belongsTo(models.DomainType, { foreignKey: "domainTypeId", onDelete: "SET NULL" });
  };

  return CaseStudy;
};
