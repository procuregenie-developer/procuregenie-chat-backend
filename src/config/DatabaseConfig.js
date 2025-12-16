const { Sequelize } = require('sequelize');
const initModels = require('../models/init_models');

class DBConnection {
    constructor() {
        this.sequelize = null;
        this.models = null;
    };
    dbHandleConnection(config) {
        this.sequelize = new Sequelize(config.database, config.username, config.password, {
            host: config.host,
            port: config.port || 5432,
            dialect: config.dialect || 'postgres',
            logging: false,
        });
        this.sequelize.authenticate();
        this.models = initModels(this.sequelize);
    }
}
let dbConnection = new DBConnection();
module.exports = { dbConnection: dbConnection };