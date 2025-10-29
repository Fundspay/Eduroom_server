"use strict";
module.exports = (sequelize, Sequelize) => {
  const SelectedQuestionModel = sequelize.define(
    "SelectedQuestionModel",
    {
      id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
      selectedDomainId: { type: Sequelize.BIGINT, allowNull: false },
      userId: { type: Sequelize.BIGINT, allowNull: true },
      day: { type: Sequelize.INTEGER, allowNull: false },
      sessionNumber: { type: Sequelize.INTEGER, allowNull: false },
      question: { type: Sequelize.TEXT, allowNull: false },
      optionA: { type: Sequelize.TEXT, allowNull: true },
      optionB: { type: Sequelize.TEXT, allowNull: true },
      optionC: { type: Sequelize.TEXT, allowNull: true },
      optionD: { type: Sequelize.TEXT, allowNull: true },
      answer: { type: Sequelize.TEXT, allowNull: true },
      keywords: { type: Sequelize.TEXT, allowNull: true },
      caseStudy: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    {
      timestamps: true,
      tableName: "SelectedQuestionModels",
    }
  );

  SelectedQuestionModel.associate = function (models) {
    SelectedQuestionModel.belongsTo(models.SelectedDomain, {
      foreignKey: "selectedDomainId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return SelectedQuestionModel;
};
