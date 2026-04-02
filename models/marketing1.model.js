"use strict";

module.exports = (sequelize, Sequelize) => {
    const Marketing = sequelize.define(
        "Marketing",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },

          
            name: { type: Sequelize.STRING, allowNull: false },
            email: { type: Sequelize.STRING, allowNull: false },
            phoneNumber: { type: Sequelize.STRING, allowNull: false },
            ratings: { type: Sequelize.DECIMAL(3, 2), allowNull: true, defaultValue: null },
            reviews: { type: Sequelize.INTEGER, allowNull: true, defaultValue: null },

          
            socialPlatforms: { type: Sequelize.JSON, allowNull: true, defaultValue: [], },
            followersCount: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0, },

            // 🔹 Content Activity
            posts: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },

            // 🔹 Google Reviews
            googleReviews: {
                type: Sequelize.INTEGER,
                allowNull: true,
                defaultValue: 0,
            },

            // 🔹 System Fields
            isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW,
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW,
            },
        },
        {
            tableName: "Marketing",
            timestamps: true,
        }
    );

    // ✅ Associations
    Marketing.associate = (models) => {
        Marketing.belongsTo(models.User, {
            foreignKey: "userId",
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
        });
    };

    return Marketing;
};