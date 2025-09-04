"use strict";
module.exports = (sequelize, Sequelize) => {
  const Course = sequelize.define(
    "Course",
    {
      id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
      userId: { type: Sequelize.BIGINT, allowNull: false },
      tutorId: { type: Sequelize.BIGINT, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.JSON, allowNull: true },
      youtubeLink: { type: Sequelize.STRING, allowNull: true },
      duration: { type: Sequelize.INTEGER, allowNull: true },
      businessTarget: { type: Sequelize.INTEGER, allowNull: true },
      type: { type: Sequelize.STRING, allowNull: true },
      isDeleted: { type: Sequelize.BOOLEAN, defaultValue: false }
    },
    {
      tableName: "Courses",
      timestamps: true
    }
  );

  Course.associate = (models) => {
    Course.belongsTo(models.Tutor, { foreignKey: "tutorId" });
    Course.belongsTo(models.User, { foreignKey: "userId" });
    Course.hasMany(models.MCQ, { foreignKey: "courseId" });
    Course.hasMany(models.CaseStudy, { foreignKey: "courseId" });
  };

  return Course;
};
