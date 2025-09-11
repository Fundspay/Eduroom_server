"use strict";
module.exports = (sequelize, Sequelize) => {
    const OfferLetter = sequelize.define(
        "OfferLetter",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            userId: { type: Sequelize.BIGINT, allowNull: false },
            position: { type: Sequelize.STRING, allowNull: false },
            startDate: { type: Sequelize.DATEONLY, allowNull: true },
            location: { type: Sequelize.STRING, allowNull: true },
            fileUrl: { type: Sequelize.STRING, allowNull: false },
            issent: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }

        },
        {
            tableName: "OfferLetters",
            timestamps: true,
        }
    );

    // ✅ Associations
    OfferLetter.associate = (models) => {
        OfferLetter.belongsTo(models.User, {
            foreignKey: "userId",
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
            constraints: true,
        });
    };

    return OfferLetter;
};
