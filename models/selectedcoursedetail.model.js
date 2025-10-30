"use strict";
module.exports = (sequelize, Sequelize) => {
    const SelectedCourseDetail = sequelize.define(
        "SelectedCourseDetail",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },

            // ✅ Renamed from domainId → selectedDomainId
            selectedDomainId: { type: Sequelize.BIGINT, allowNull: false },

            userId: { type: Sequelize.BIGINT, allowNull: true },
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
            tableName: "SelectedCourseDetails" // ✅ Use pluralized, clear table name
        }
    );

    SelectedCourseDetail.associate = function(models) {
        // ✅ Updated association for selectedDomainId
        SelectedCourseDetail.belongsTo(models.SelectionDomain, { 
            foreignKey: "selectedDomainId", 
            onDelete: "RESTRICT", 
            onUpdate: "RESTRICT" 
        });

        SelectedCourseDetail.belongsTo(models.User, { 
            foreignKey: "userId",
            onDelete: "RESTRICT", 
            onUpdate: "RESTRICT" 
        });

        
    };

    return SelectedCourseDetail;
};
