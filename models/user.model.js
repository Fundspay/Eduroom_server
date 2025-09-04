"use strict";
module.exports = (sequelize, Sequelize) => {
    const User = sequelize.define(
        "User",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            firstName: { type: Sequelize.STRING, allowNull: false },
            lastName: { type: Sequelize.STRING, allowNull: false },
            gender: { type: Sequelize.BIGINT, allowNull: true },
            email: { type: Sequelize.STRING, allowNull: true, unique: true },
            phoneNumber: { type: Sequelize.STRING, allowNull: true, unique: true },
            password: { type: Sequelize.STRING, allowNull: false },
            lastLoginAt: { type: Sequelize.DATE, allowNull: true },
            lastLogoutAt: { type: Sequelize.DATE, allowNull: true },
            isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },

            // New fields
            collegeName: { type: Sequelize.STRING, allowNull: true },
            course: { type: Sequelize.STRING, allowNull: true },
            state: { type: Sequelize.STRING, allowNull: true },
            city: { type: Sequelize.STRING, allowNull: true },
            referralCode: { type: Sequelize.STRING, allowNull: true, unique: true },
            referralLink: { type: Sequelize.STRING, allowNull: true },
            resetToken: { type: Sequelize.STRING, allowNull: true },
            resetTokenExpiry: { type: Sequelize.DATE, allowNull: true },
            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        },
        {
            tableName: "Users",
            timestamps: true,
        }
    );

    // ✅ Associations
    User.associate = (models) => {
        User.belongsTo(models.Gender, {
            foreignKey: "gender",
            onDelete: "RESTRICT",
            onUpdate: "RESTRICT",
            constraints: true,
        });
    };

    return User;
};
