"use strict";
module.exports = (sequelize, Sequelize) => {
    const Domain = sequelize.define(
        "Domain",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            name: { type: Sequelize.TEXT, allowNull: false, unique: true },
            image: { type: Sequelize.STRING, allowNull: true }, 
            description: { type: Sequelize.TEXT, allowNull: true }, 
            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        { timestamps: true }
    );

    

    return Domain;
};
