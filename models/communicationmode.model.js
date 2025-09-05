"use strict";
module.exports = (sequelize, Sequelize) => {
    const CommunicationMode = sequelize.define(
        "CommunicationMode",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            name: { type: Sequelize.STRING, allowNull: false, unique: true }, // WhatsApp, Email, Call
        },
        {
            tableName: "CommunicationModes",
            timestamps: false,
        }
    );
    return CommunicationMode;
};
