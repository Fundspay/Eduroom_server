"use strict";
module.exports = (sequelize, Sequelize) => {
    const SelectedCaseStudyResult = sequelize.define(
        "SelectedCaseStudyResult",
        {
            id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
            userId: { type: Sequelize.BIGINT, allowNull: false },
            selectedCourseId: { type: Sequelize.BIGINT, allowNull: false }, 
            selectedDomainId: { type: Sequelize.BIGINT, allowNull: false }, // 🔹 replaces courseId & coursePreviewId
            day: { type: Sequelize.INTEGER, allowNull: false },
            sessionNumber: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
            questionId: { type: Sequelize.BIGINT, allowNull: false },
            answer: { type: Sequelize.TEXT, allowNull: false },
            matchPercentage: { type: Sequelize.FLOAT, allowNull: false },
            passed: { type: Sequelize.BOOLEAN, allowNull: false },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
        },
        { 
            timestamps: true,
            tableName: "SelectedCaseStudyResults" // 🔹 custom table name (plural)
        }
    );

    SelectedCaseStudyResult.associate = function(models) {
        // 🔹 Link to user
        SelectedCaseStudyResult.belongsTo(models.User, { 
            foreignKey: "userId", 
            onDelete: "CASCADE", 
            onUpdate: "CASCADE" 
        });

        // 🔹 Link to SelectedCourseDetail
        SelectedCaseStudyResult.belongsTo(models.SelectedCourseDetail, { 
            foreignKey: "selectedCourseId", 
            onDelete: "CASCADE", 
            onUpdate: "CASCADE" 
        });

        // 🔹 Link to SelectedQuestionModel
        SelectedCaseStudyResult.belongsTo(models.SelectedQuestionModel, { 
            foreignKey: "questionId", 
            onDelete: "CASCADE", 
            onUpdate: "CASCADE" 
        });

        SelectedCaseStudyResult.belongsTo(models.SelectedDomain, { 
            foreignKey: "selectedDomainId", 
            onDelete: "CASCADE", 
            onUpdate: "CASCADE" 
        });
    };

    return SelectedCaseStudyResult;
};
