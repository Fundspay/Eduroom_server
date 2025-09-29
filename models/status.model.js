"use strict";
module.exports = (sequelize, Sequelize) => {
    const Status = sequelize.define(
        "Status",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            userId: { type: Sequelize.BIGINT, allowNull: false },
            userName: { type: Sequelize.STRING, allowNull: false },
            email: { type: Sequelize.STRING, allowNull: true },
            phoneNumber: { type: Sequelize.STRING, allowNull: true },
            collegeName: { type: Sequelize.STRING, allowNull: true },
            subscriptionWallet: { type: Sequelize.FLOAT, allowNull: true, defaultValue: 0 },
            subscriptionLeft: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
            courses: { type: Sequelize.JSON, allowNull: true }, // store course details as JSON
            internshipIssued: { type: Sequelize.BOOLEAN, allowNull: true },
            internshipStatus: { type: Sequelize.STRING, allowNull: true },
            offerLetterSent: { type: Sequelize.BOOLEAN, allowNull: true },
            offerLetterFile: { type: Sequelize.STRING, allowNull: true },
            teamManager: { type: Sequelize.STRING, allowNull: true },
            isQueryRaised: { type: Sequelize.BOOLEAN, allowNull: true },
            queryStatus: { type: Sequelize.STRING, allowNull: true },
            querycount: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
            registeredAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
        },
        {
            tableName: "Statuses",
            timestamps: true,
        }
    );

    // ✅ Associations
    Status.associate = (models) => {
        Status.belongsTo(models.User, {
            foreignKey: "userId",
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
            constraints: true,
        });
    };

    return Status;
};
