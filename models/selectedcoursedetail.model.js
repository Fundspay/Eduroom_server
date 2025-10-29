"use strict";
module.exports = (sequelize, Sequelize) => {
    const SelectedDomain = sequelize.define(
        "SelectedDomain",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },

            // ✅ Renamed from domainId → selectedDomainId
            selectedDomainId: { type: Sequelize.BIGINT, allowNull: false },

            userId: { type: Sequelize.BIGINT, allowNull: true },
            day: { type: Sequelize.INTEGER, allowNull: false }, // Day number
            sessionNumber: { type: Sequelize.INTEGER, allowNull: false },
            sessionDuration: { type: Sequelize.INTEGER, allowNull: true }, // Session duration in minutes
            title: { type: Sequelize.TEXT, allowNull: false },
            description: { type: Sequelize.TEXT, allowNull: true },
            duration: { type: Sequelize.INTEGER, allowNull: true },
            heading: { type: Sequelize.TEXT, allowNull: true },
            youtubeLink: { type: Sequelize.TEXT, allowNull: true },

            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        { 
            timestamps: true,
            tableName: "SelectedDomains" // ✅ Use pluralized, clear table name
        }
    );

    SelectedDomain.associate = function(models) {
        // ✅ Updated association for selectedDomainId
        SelectedDomain.belongsTo(models.SelectedDomain, { 
            foreignKey: "selectedDomainId", 
            onDelete: "RESTRICT", 
            onUpdate: "RESTRICT" 
        });

        SelectedDomain.belongsTo(models.User, { 
            foreignKey: "userId", 
            onDelete: "RESTRICT", 
            onUpdate: "RESTRICT" 
        });

        
    };

    return SelectedDomain;
};
