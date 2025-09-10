"use strict";
module.exports = (sequelize, Sequelize) => {
    const Course = sequelize.define(
        "Course",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            domainId: { type: Sequelize.BIGINT, allowNull: false },
            name: { type: Sequelize.TEXT, allowNull: false },
            img: { type: Sequelize.STRING, allowNull: true }, 
            description: { type: Sequelize.TEXT, allowNull: true },
            businessTarget: { type: Sequelize.STRING, allowNull: true }, 
            totalDays: { type: Sequelize.INTEGER, allowNull: true },
            duration: { type: Sequelize.STRING, allowNull: true },
            certificateCount : { type: Sequelize.INTEGER, allowNull: true },
            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        { timestamps: true }
    );

    Course.associate = function (models) {
        Course.belongsTo(models.Domain, {
            foreignKey: "domainId",
            onDelete: "RESTRICT",
            onUpdate: "RESTRICT",
            constraints: true,
        });

        Course.hasMany(models.CoursePreview, {
            foreignKey: "courseId",
            onDelete: "CASCADE",
            onUpdate: "CASCADE"
        });
    };

    return Course;
};
