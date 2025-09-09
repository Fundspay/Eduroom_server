"use strict";
module.exports = (sequelize, Sequelize) => {
    const CaseStudyResult = sequelize.define(
        "CaseStudyResult",
        {
            id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
            userId: { type: Sequelize.BIGINT, allowNull: false },
            courseId: { type: Sequelize.BIGINT, allowNull: false },
            coursePreviewId: { type: Sequelize.BIGINT, allowNull: false },
            day: { type: Sequelize.INTEGER, allowNull: false },
            questionId: { type: Sequelize.BIGINT, allowNull: false },
            answer: { type: Sequelize.TEXT, allowNull: false },
            matchPercentage: { type: Sequelize.FLOAT, allowNull: false },
            passed: { type: Sequelize.BOOLEAN, allowNull: false },
            sessionNumber: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
        },
        { timestamps: true }

        
    );

    CaseStudyResult.associate = function(models) {
    // Link the result to the user who submitted it
    CaseStudyResult.belongsTo(models.User, { foreignKey: "userId", onDelete: "CASCADE", onUpdate: "CASCADE" });

    // Link the result to the course
    CaseStudyResult.belongsTo(models.Course, { foreignKey: "courseId", onDelete: "CASCADE", onUpdate: "CASCADE" });

    // Link the result to the course preview
    CaseStudyResult.belongsTo(models.CoursePreview, { foreignKey: "coursePreviewId", onDelete: "CASCADE", onUpdate: "CASCADE" });

    // Link the result to the question (case study)
    CaseStudyResult.belongsTo(models.QuestionModel, { foreignKey: "questionId", onDelete: "CASCADE", onUpdate: "CASCADE" });
};


    return CaseStudyResult;
};
