"use strict";
module.exports = (sequelize, Sequelize) => {
  const InternshipCertificate = sequelize.define(
    "InternshipCertificate",
    {
      id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
      userId: { type: Sequelize.BIGINT, allowNull: false },
      courseId: { type: Sequelize.BIGINT, allowNull: false }, // link to Course
      certificateUrl: { type: Sequelize.STRING, allowNull: true },
      issuedDate: { type: Sequelize.DATEONLY, allowNull: true },
      deductedWallet: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      isIssued: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    },
    {
      tableName: "InternshipCertificates",
      timestamps: true
    }
  );

  // ✅ Associations
  InternshipCertificate.associate = (models) => {
    InternshipCertificate.belongsTo(models.User, {
      foreignKey: "userId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      constraints: true
    });

    InternshipCertificate.belongsTo(models.Course, {
      foreignKey: "courseId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      constraints: true
    });
  };

  return InternshipCertificate;
};
