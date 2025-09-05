"use strict";
module.exports = (sequelize, Sequelize) => {
    const Domain = sequelize.define(
        "Domain",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            name: { type: Sequelize.TEXT, allowNull: false, unique: true },
            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        { timestamps: true }
    );

    Domain.associate = function (models) {
        Domain.hasMany(models.DomainType, {
            foreignKey: "domainId",
            onDelete: "RESTRICT",
            onUpdate: "RESTRICT",
            constraints: true,
            
        });
    };

    return Domain;
};
