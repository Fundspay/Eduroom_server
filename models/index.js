"use strict";
const CONFIG = require("../config/config");
const logger = require("../utils/logger.service");

const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const basename = path.basename(__filename);
const db = {};

// Ensure password is always a string if used
const dbPassword = CONFIG.db_usePassword ? String(CONFIG.db_password) : null;

// Optimized Sequelize options
const sequelizeOptions = {
    host: CONFIG.db_host,
    port: CONFIG.db_port,
    dialect: CONFIG.db_dialect || "postgres",
    pool: {
        max: 15,          // max connections in pool
        min: 0,
        acquire: 60000,   // wait up to 60 seconds to acquire a connection
        idle: 10000,      // close idle connections after 10 seconds
    },
    logging: msg => logger.debug(msg),
    define: {
        freezeTableName: true, // prevent plural table names
        timestamps: true,      // automatically handle createdAt/updatedAt
    },
    retry: {
        max: 3                 // retry transient errors like timeouts
    }
};

// Initialize Sequelize
const sequelize = new Sequelize(CONFIG.db_name, CONFIG.db_user, dbPassword, sequelizeOptions);

// Load models dynamically
fs.readdirSync(__dirname)
    .filter(file => file.indexOf(".") !== 0 && file !== basename && file.slice(-3) === ".js")
    .forEach(file => {
        const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
        db[model.name] = model;
    });

// Apply associations if defined
Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

// Export Sequelize instance and models
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
