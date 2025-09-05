"use strict";
module.exports = (sequelize, Sequelize) => {
    const DomainType = sequelize.define(
        "DomainType",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            domainId: { type: Sequelize.BIGINT, allowNull: false },

            name: { type: Sequelize.TEXT, allowNull: false },
            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        { timestamps: true }
    );

    DomainType.associate = function (models) {
        DomainType.belongsTo(models.Domain, {
            foreignKey: "domainId",
            onDelete: "RESTRICT",
            onUpdate: "RESTRICT",
            constraints: true,
        });
    };

    return DomainType;
};
