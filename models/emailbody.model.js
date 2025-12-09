"use strict";
module.exports = (sequelize, Sequelize) => {
  const EmailTemplate = sequelize.define(
    "EmailTemplate",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      // unique key like "jd_email_template"
      key: { type: Sequelize.STRING, allowNull: false, unique: true },

      subject: { type: Sequelize.TEXT, allowNull: true },

      body: { type: Sequelize.TEXT("long"), allowNull: false },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    },
    {
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["key"],
        },
      ],
    }
  );

  EmailTemplate.associate = function (models) {
    // No associations needed now, but keeping function for future expansion
  };

  return EmailTemplate;
};
