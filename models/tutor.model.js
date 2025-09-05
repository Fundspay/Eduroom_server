"use strict";
module.exports = (sequelize, Sequelize) => {
  const Tutor = sequelize.define(
    "Tutor",
    {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      userId: { type: Sequelize.BIGINT, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      courseId: { type: Sequelize.BIGINT, allowNull: true },
      domainId: { type: Sequelize.BIGINT, allowNull: true },
      domainTypeId: { type: Sequelize.BIGINT, allowNull: true },
    },
    {
      tableName: "Tutors",
      timestamps: true
    }
  );

  Tutor.associate = function (models) {
    Tutor.belongsTo(models.User, { foreignKey: "userId", onDelete: "CASCADE" });
    Tutor.hasMany(models.Course, { foreignKey: "tutorId", onDelete: "CASCADE" });
    Tutor.belongsTo(models.Course, { foreignKey: "courseId", onDelete: "CASCADE" });
    Tutor.belongsTo(models.Domain, { foreignKey: "domainId", onDelete: "CASCADE" });
    Tutor.belongsTo(models.DomainType, { foreignKey: "domainTypeId", onDelete: "SET NULL" });
  };

  return Tutor;
};
