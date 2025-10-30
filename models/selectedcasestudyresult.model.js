"use strict";

module.exports = (sequelize, Sequelize) => {
    const SelectedCaseStudyResult = sequelize.define(
        "SelectedCaseStudyResult",
        {
            id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
            userId: { type: Sequelize.BIGINT, allowNull: false },

            // 🔹 Updated fields
            selectedDomainId: { type: Sequelize.BIGINT, allowNull: false }, 
            questionId: { type: Sequelize.BIGINT, allowNull: false },
            answer: { type: Sequelize.TEXT, allowNull: false },
            matchPercentage: { type: Sequelize.FLOAT, allowNull: false },
            passed: { type: Sequelize.BOOLEAN, allowNull: false },

            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
        },
        {
            timestamps: true,
            tableName: "SelectedCaseStudyResults" // ✅ consistent table naming
        }
    );

    // 🔗 Define associations
    SelectedCaseStudyResult.associate = function(models) {
        // Link to User
        SelectedCaseStudyResult.belongsTo(models.User, {
            foreignKey: "userId",
            onDelete: "CASCADE",
            onUpdate: "CASCADE"
        });

        // Link to SelectedDomain (replaces course-related models)
        SelectedCaseStudyResult.belongsTo(models.SelectionDomain, {
            foreignKey: "selectedDomainId",
            onDelete: "CASCADE",
            onUpdate: "CASCADE"
        });

        // Link to SelectedQuestionModel
        SelectedCaseStudyResult.belongsTo(models.SelectedQuestionModel, {
            foreignKey: "questionId",
            onDelete: "CASCADE",
            onUpdate: "CASCADE"
        });
    };

    return SelectedCaseStudyResult;
};
