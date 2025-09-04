"use strict";
module.exports = (sequelize, Sequelize) => {
    const Gender = sequelize.define(
        "Gender",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            user: { type: Sequelize.BIGINT, allowNull: true },

            name: { type: Sequelize.TEXT, allowNull: false},
            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        { timestamps: true }
    );
    Gender.associate = function (models) {

        Gender.belongsTo(models.User, {
            foreignKey: 'user',
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
            constraints: true,
        });
    };
    return Gender;
};

