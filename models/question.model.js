"use strict";
module.exports = (sequelize, Sequelize) => {
    const QuestionModel = sequelize.define(
        "QuestionModel",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            domainId: { type: Sequelize.BIGINT, allowNull: false },
            courseId: { type: Sequelize.BIGINT, allowNull: false },
            coursePreviewId: { type: Sequelize.BIGINT, allowNull: false },
            day: { type: Sequelize.INTEGER, allowNull: false }, // Day number
            question: { type: Sequelize.TEXT, allowNull: false },
            optionA: { type: Sequelize.TEXT, allowNull: false },
            optionB: { type: Sequelize.TEXT, allowNull: false },
            optionC: { type: Sequelize.TEXT, allowNull: false },
            optionD: { type: Sequelize.TEXT, allowNull: false },
            answer: { type: Sequelize.STRING, allowNull: false }, // "A", "B", "C", or "D"
            keywords: { type: Sequelize.TEXT, allowNull: true },
            caseStudy: { type: Sequelize.TEXT, allowNull: true },
            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        { timestamps: true }
    );

    QuestionModel.associate = function(models) {
        QuestionModel.belongsTo(models.Course, { foreignKey: "courseId", onDelete: "RESTRICT", onUpdate: "RESTRICT" });
        QuestionModel.belongsTo(models.Domain, { foreignKey: "domainId", onDelete: "RESTRICT", onUpdate: "RESTRICT" });
        QuestionModel.belongsTo(models.CoursePreview, { foreignKey: "coursePreviewId", onDelete: "RESTRICT", onUpdate: "RESTRICT" });
        QuestionModel.belongsTo(models.CourseDetail, { foreignKey: "day", targetKey: "day" }); // Map to day in CourseDetail
    };

    return QuestionModel;
};
