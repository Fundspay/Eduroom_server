"use strict";
module.exports = (sequelize, Sequelize) => {
    const User = sequelize.define(
        "User",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },

            // 🔹 Student Personal Information
            firstName: { type: Sequelize.STRING, allowNull: false },
            lastName: { type: Sequelize.STRING, allowNull: false },
            fullName: { type: Sequelize.STRING, allowNull: true }, // Official name
            dateOfBirth: { type: Sequelize.DATEONLY, allowNull: true },
            gender: { type: Sequelize.BIGINT, allowNull: true }, // FK -> Gender table

            // 🔹 Contact Info
            phoneNumber: { type: Sequelize.STRING, allowNull: true, unique: true }, // WhatsApp preferred
            alternatePhoneNumber: { type: Sequelize.STRING, allowNull: true },
            email: { type: Sequelize.STRING, allowNull: true, unique: true },
            residentialAddress: { type: Sequelize.TEXT, allowNull: true },
            emergencyContactName: { type: Sequelize.STRING, allowNull: true },
            emergencyContactNumber: { type: Sequelize.STRING, allowNull: true },
            city: { type: Sequelize.STRING, allowNull: true },
            state: { type: Sequelize.STRING, allowNull: true },
            pinCode: { type: Sequelize.STRING, allowNull: true },

            // 🔹 Educational Details
            collegeName: { type: Sequelize.STRING, allowNull: true },
            collegeRollNumber: { type: Sequelize.STRING, allowNull: true },
            course: { type: Sequelize.STRING, allowNull: true },
            specialization: { type: Sequelize.STRING, allowNull: true },
            currentYear: { type: Sequelize.STRING, allowNull: true },
            currentSemester: { type: Sequelize.STRING, allowNull: true },
            collegeAddress: { type: Sequelize.TEXT, allowNull: true },
            placementCoordinatorName: { type: Sequelize.STRING, allowNull: true },
            placementCoordinatorContact: { type: Sequelize.STRING, allowNull: true },

            // 🔹 Internship Details
            internshipProgram: { type: Sequelize.STRING, allowNull: true },
            internshipDuration: { type: Sequelize.STRING, allowNull: true }, // e.g., 30/45/60 days
            internshipModeId: { type: Sequelize.BIGINT, allowNull: true }, // FK -> InternshipMode table
            preferredStartDate: { type: Sequelize.DATEONLY, allowNull: true },
            referralCode: { type: Sequelize.STRING, allowNull: true, unique: true },
            referralLink: { type: Sequelize.STRING, allowNull: true },
            referralSource: { type: Sequelize.STRING, allowNull: true },

            // 🔹 Verification
            studentIdCard: { type: Sequelize.STRING, allowNull: true }, // file path / URL
            governmentIdProof: { type: Sequelize.STRING, allowNull: true },
            passportPhoto: { type: Sequelize.STRING, allowNull: true },

            // 🔹 Bank / Payment (kept inside User model)
            accountHolderName: { type: Sequelize.STRING, allowNull: true },
            bankName: { type: Sequelize.STRING, allowNull: true },
            branchAddress: { type: Sequelize.STRING, allowNull: true },
            ifscCode: { type: Sequelize.STRING, allowNull: true },
            accountNumber: { type: Sequelize.STRING, allowNull: true, unique: true },

            // 🔹 Communication
            preferredCommunicationId: { type: Sequelize.BIGINT, allowNull: true }, // FK -> CommunicationMode table
            linkedInProfile: { type: Sequelize.STRING, allowNull: true },

            // 🔹 Consent / Declaration
            studentDeclaration: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            consentAgreement: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            businessTargets: {
                type: Sequelize.JSON,
                allowNull: true,
                defaultValue: {}
            },

            // 🔹 Auth & System
            password: { type: Sequelize.STRING, allowNull: false },
            resetToken: { type: Sequelize.STRING, allowNull: true },
            resetTokenExpiry: { type: Sequelize.DATE, allowNull: true },
            lastLoginAt: { type: Sequelize.DATE, allowNull: true },
            lastLogoutAt: { type: Sequelize.DATE, allowNull: true },
            isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

            // 🔹 Sequelize Defaults
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        {
            tableName: "Users",
            timestamps: true,
        }
    );

    // ✅ Associations
    User.associate = (models) => {
        User.belongsTo(models.Gender, {
            foreignKey: "gender",
            onDelete: "RESTRICT",
            onUpdate: "RESTRICT",
            constraints: true,
        });

        User.belongsTo(models.CommunicationMode, {
            foreignKey: "preferredCommunicationId",
            onDelete: "RESTRICT",
            onUpdate: "RESTRICT",
            constraints: true,

        });

        User.belongsTo(models.InternshipMode, {
            foreignKey: "internshipModeId",
            onDelete: "RESTRICT",
            onUpdate: "RESTRICT",
            constraints: true,
        });
    };

    return User;
};
