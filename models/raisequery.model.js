"use strict";
module.exports = (sequelize, Sequelize) => {
  const RaiseQuery = sequelize.define(
    "RaiseQuery",
    {
      id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
      userId: { type: Sequelize.BIGINT, allowNull: false },
      fundsAuditUserId: { type: Sequelize.BIGINT, allowNull: true }, // user assigned for funds audit
      isQueryRaised: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      internshipStatus: { type: Sequelize.STRING, allowNull: true }, // e.g., Active, Completed, Pending
      isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    { timestamps: true }
  );

  RaiseQuery.associate = function (models) {
    // Each query belongs to a user
    RaiseQuery.belongsTo(models.User, {
      foreignKey: "userId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      constraints: true,
    });
  };

  return RaiseQuery;
};
