"use strict";
module.exports = (sequelize, Sequelize) => {
    const InternshipMode = sequelize.define(
        "InternshipMode",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            name: { type: Sequelize.STRING, allowNull: false, unique: true }, // WFH, Hybrid, Onsite
            isDeleted: { type: Sequelize.BOOLEAN, defaultValue: false },
        },
        {
            tableName: "InternshipModes",
            timestamps: false,
        }
    );
    return InternshipMode;
};
