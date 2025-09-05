"use strict";
module.exports = (sequelize, Sequelize) => {
    const InternshipMode = sequelize.define(
        "InternshipMode",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            name: { type: Sequelize.STRING, allowNull: false, unique: true }, // WFH, Hybrid, Onsite
        },
        {
            tableName: "InternshipModes",
            timestamps: false,
        }
    );
    return InternshipMode;
};
