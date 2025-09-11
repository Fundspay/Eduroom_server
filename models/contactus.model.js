"use strict";
module.exports = (sequelize, Sequelize) => {
    const ContactUs = sequelize.define(
        "ContactUs",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            Name: { type: Sequelize.TEXT, allowNull: false },
            email: { type: Sequelize.TEXT, allowNull: false },
            phone: { type: Sequelize.TEXT, allowNull: true },
            message: { type: Sequelize.TEXT, allowNull: true },
            userId: { type: Sequelize.BIGINT, allowNull: false },
            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        { timestamps: true }
    );

    ContactUs.associate = models => {
        ContactUs.belongsTo(models.User, { foreignKey: "userId" });
    
    };

    return ContactUs;
};
