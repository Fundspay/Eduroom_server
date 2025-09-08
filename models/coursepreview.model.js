"use strict";
module.exports = (sequelize, Sequelize) => {
    const CoursePreview = sequelize.define(
        "CoursePreview",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            courseId: { type: Sequelize.BIGINT, allowNull: false },
            domainId: { type: Sequelize.BIGINT, allowNull: false },
            
            title: { type: Sequelize.TEXT, allowNull: false },
            heading: { type: Sequelize.TEXT, allowNull: false },
            youtubeLink: { type: Sequelize.TEXT, allowNull: true },
            description: { type: Sequelize.TEXT, allowNull: true },
            totalLectures: { type: Sequelize.INTEGER, allowNull: true },
            language: { type: Sequelize.STRING, allowNull: true },
            whatYouWillLearn: { type: Sequelize.TEXT, allowNull: true },
            durationPerDay: { type: Sequelize.STRING, allowNull: true },

            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        { timestamps: true }
    );

    CoursePreview.associate = function (models) {
        CoursePreview.belongsTo(models.Course, {
            foreignKey: "courseId",
            onDelete: "RESTRICT",
            onUpdate: "RESTRICT",
            constraints: true,
        });
        CoursePreview.belongsTo(models.Domain, {
            foreignKey: "domainId",
            onDelete: "RESTRICT",
            onUpdate: "RESTRICT",
            constraints: true,
        });
    };

    return CoursePreview;
};
