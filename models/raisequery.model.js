"use strict";
module.exports = (sequelize, Sequelize) => {
  const RaiseQuery = sequelize.define(
    "RaiseQuery",
    {
      id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
      userId: { type: Sequelize.BIGINT, allowNull: false }, // reference to user
      fundsAuditUserId: { type: Sequelize.STRING, allowNull: true }, // user assigned for funds audit
      isQueryRaised: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      queryStatus: { type: Sequelize.STRING, allowNull: true }, // e.g., Active, Completed, Pending
      first_name: { type: Sequelize.STRING, allowNull: true }, // store user's first name
      last_name: { type: Sequelize.STRING, allowNull: true },  // store user's last name
      phone_number: { type: Sequelize.STRING, allowNull: true }, // store user's phone number
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
