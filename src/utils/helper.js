const { QueryTypes } = require('sequelize');
const { configurationProvider } = require('../services/ChatService');
// Duplicate the helper functions from the original file
function getUserMessagesMaster() {
    let { models } = configurationProvider?.getConfig?.();
    const message = models?.message;
    return message;
};

async function getUserInfo(userId) {
    try {
        const sequelize = configurationProvider.getConfig()?.sequelize;
        const userModel = configurationProvider.getConfig().userModel;
        const tableName = userModel.name;
        const columns = userModel.columns;

        let usernameExpr = "''";
        if (columns.username?.columns?.length > 0) {
            usernameExpr = columns.username.columns
                .map(col => `"${col}"`)
                .join(` || ' ' || `);
        }

        const sql = `
            SELECT id, ${usernameExpr} AS username
            FROM "${tableName}"
            WHERE id = :userId
            LIMIT 1;
        `;

        const [user] = await sequelize.query(sql, {
            replacements: { userId },
            type: QueryTypes.SELECT,
        });

        return user || null;
    } catch (error) {
        console.error("getUserInfo error:", error);
        return null;
    }
};

async function getGroupMembers(){
    return [];
}

module.exports = {
    getUserInfo,
    getUserMessagesMaster,
    getGroupMembers
};