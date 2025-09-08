"use strict";
module.exports = (sequelize, Sequelize) => {
    const CourseDetail = sequelize.define(
        "CourseDetail",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            domainId: { type: Sequelize.BIGINT, allowNull: false },
            courseId: { type: Sequelize.BIGINT, allowNull: false },
            coursePreviewId: { type: Sequelize.BIGINT, allowNull: false },
            userId: { type: Sequelize.BIGINT, allowNull: false },
            day: { type: Sequelize.INTEGER, allowNull: false }, // Day number
            title: { type: Sequelize.TEXT, allowNull: false },
            description: { type: Sequelize.TEXT, allowNull: true },
            youtubeLink: { type: Sequelize.TEXT, allowNull: true },
            userProgress: { type: Sequelize.JSON, allowNull: true, defaultValue: {} }, 
            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        { timestamps: true }
    );

    CourseDetail.associate = function(models) {
        CourseDetail.belongsTo(models.Course, { foreignKey: "courseId", onDelete: "RESTRICT", onUpdate: "RESTRICT" });
        CourseDetail.belongsTo(models.Domain, { foreignKey: "domainId", onDelete: "RESTRICT", onUpdate: "RESTRICT" });
        CourseDetail.belongsTo(models.CoursePreview, { foreignKey: "coursePreviewId", onDelete: "RESTRICT", onUpdate: "RESTRICT" });
        CourseDetail.belongsTo(models.User, { foreignKey: "userId", onDelete: "RESTRICT", onUpdate: "RESTRICT" });
        CourseDetail.hasMany(models.QuestionModel, { foreignKey: "day", sourceKey: "day" }); // Link questions by day
    };

    return CourseDetail;
};
