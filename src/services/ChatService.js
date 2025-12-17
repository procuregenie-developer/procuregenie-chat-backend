const { Sequelize, Op, QueryTypes } = require("sequelize");
const { dbConnection } = require("../config/DatabaseConfig");
const { fileManager } = require("../utils/filemanager");

/**
 * Sync Database Tables
 */
async function syncDatabase() {
    if (!dbConnection.sequelize) return;
    await dbConnection.sequelize?.sync({ alter: true });
}

/**
 * Configuration Provider (Global Storage)
 */
const configurationProvider = {
    configurationDetails: {
        syncDatabase: null,
        models: null,
        sequelize: null,

        /** Services */
        getAllUsers: null,
        getGroups: null,
        createGroup: null,
        updateGroup: null,
        userModel: null
    },

    setConfig(config) {
        this.configurationDetails = {
            ...this.configurationDetails,
            ...config
        };
    },

    getConfig() {
        return this.configurationDetails;
    }
};

/**
 * Main Service Class
 */
class Service {
    constructor() {
        this.dbconfig = {
            host: null,
            username: null,
            password: null,
            database: null,
            port: 5432,
            dialect: null,
        };

        this.userModel = {
            name: null,
            columns: {
                id: null,
                username: null,
                email: null,
                phoneNumber: null
            },
        };
    }

    /**
     * Validate Config (Strong Validation)
     */
    validateConfig() {
        const requiredDbFields = ["host", "username", "password", "database", "dialect"];

        for (const field of requiredDbFields) {
            if (!this.dbconfig[field]) {
                throw new Error(`Database Config Missing: '${field}'`);
            }
        }

        const modelRequired = ["name", "columns"];
        for (const field of modelRequired) {
            if (!this.userModel[field]) {
                throw new Error(`UserModel Missing: '${field}'`);
            }
        }
        const requiredColumns = ["id", "username", "email"];
        for (const col of requiredColumns) {
            if (!this.userModel.columns[col]) {
                throw new Error(`UserModel Missing column: '${col}'`);
            }

            if (
                col === "id" &&
                (!this.userModel.columns[col].columns ||
                    this.userModel.columns[col].columns.length === 0)
            ) {
                throw new Error(`UserModel 'id' must contain column list`);
            }
        }

        return true;
    };

    /**
     * Validate that all userModel columns exist in actual DB table
     */
    async dbValidation() {
        const { sequelize } = dbConnection;
        if (!sequelize) {
            throw new Error("Sequelize instance not initialized");
        }

        const tableName = this.userModel.name;
        const modelColumns = this.userModel.columns;

        // Step 1: Fetch DB columns from information_schema
        const query = `
        SELECT column_name 
        FROM information_schema.columns
        WHERE table_name = :tableName
    `;

        const dbCols = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            replacements: { tableName }
        });

        const existingColumns = dbCols.map(c => c.column_name);

        // Step 2: Collect expected columns from config
        const requiredColumns = [];
        Object.values(modelColumns).forEach(colObj => {
            if (Array.isArray(colObj.columns)) {
                requiredColumns.push(...colObj.columns);
            }
        });

        // Step 3: Find missing columns
        const missing = requiredColumns.filter(col => !existingColumns.includes(col));

        if (missing.length > 0) {
            throw new Error(
                `❌ UserModel Validation Failed. Missing columns in table '${tableName}': ${missing.join(", ")}`
            );
        }

        console.log(`✔ DB Validation Passed for table '${tableName}'`);
        return true;
    }

    /**
     * ⚡ INIT FUNCTION (MAIN ENTRYPOINT)
     * Handles:
     *   - File System
     *   - Validate Config
     *   - DB Connect
     *   - Sync Tables
     *   - Bind Services
     */
    async init({ dbconfig, userModel }) {
        try {
            /** 1. Build Upload Directories (Async Safe) */
            await fileManager?.buildStorageEnv();
            /** 2. Set Config */
            this.dbconfig = { ...this.dbconfig, ...dbconfig };
            this.userModel = { ...this.userModel, ...userModel };
            /** 3. Validate */
            this.validateConfig();
            /** 4. Connect Database */
            dbConnection.dbHandleConnection(this.dbconfig);
            await this.dbValidation();

            /** 5. Sync */
            await syncDatabase();

            /***************************************************************************
             * SERVICES
             **************************************************************************/

            /**
             * GET ALL USERS
             */
            const getAllUsers = async ({
                currentPage = 1,
                totalRecords = 10,
                search = "",
                moduleValue = 0,
                userId = null
            }) => {
                try {
                    const { sequelize, models } = configurationProvider.getConfig();

                    const tableName = this.userModel.name;
                    const columns = this.userModel.columns;

                    currentPage = Number(currentPage);
                    totalRecords = Number(totalRecords);

                    const offset = (currentPage - 1) * totalRecords;
                    const limit = totalRecords;

                    let whereParts = ["1 = 1"];
                    let replacements = {
                        search: `%${search}%`,
                        offset,
                        limit
                    };

                    if (search) {
                        const likeConditions = [];

                        Object.keys(columns).forEach(key => {
                            (columns[key].columns || []).forEach(col => {
                                if (col != "id") {
                                    likeConditions.push(`"${col}" ILIKE :search`);
                                };
                            });
                        });

                        if (likeConditions.length > 0) {
                            whereParts.push(`(${likeConditions.join(" OR ")})`);
                        }
                    }

                    if (userId) {
                        whereParts.push(`"${columns.id.columns[0]}" != :currentUserId`);
                        replacements.currentUserId = Number(userId);
                    }

                    let chatUserIds = [];
                    if (Number(moduleValue) === 1) {
                        const messageModel = models.message;

                        const chatUsers = await messageModel.findAll({
                            where: {
                                [Op.or]: [
                                    { fromUserId: userId },
                                    { toUserId: userId },
                                ],
                                messageType: "text"
                            },
                            attributes: [
                                [
                                    Sequelize.literal(`
                                        DISTINCT CASE
                                            WHEN "fromUserId" = ${Number(userId)}
                                            THEN "toUserId"
                                            ELSE "fromUserId"
                                        END
                                    `),
                                    "userId"
                                ]
                            ],
                            raw: true
                        });

                        chatUserIds = chatUsers.map(u => u.userId).filter(Boolean);
                    }

                    if (chatUserIds.length > 0) {
                        whereParts.push(`"${columns.id.columns[0]}" IN (:chatUserIds)`);
                        replacements.chatUserIds = chatUserIds;
                    }

                    const whereSQL = whereParts.join(" AND ");

                    const countQuery = `
                        SELECT COUNT(*) AS count
                        FROM "${tableName}"
                        WHERE ${whereSQL}
                    `;

                    const [{ count }] = await sequelize.query(countQuery, {
                        type: QueryTypes.SELECT,
                        replacements
                    });

                    const totalPages = Math.ceil(count / totalRecords);

                    const dbColumns = [];
                    Object.values(columns).forEach(colObj => {
                        colObj.columns.forEach(col => {
                            if (!dbColumns.includes(col)) dbColumns.push(col);
                        });
                    });

                    const selectCols = dbColumns.map(c => `"${c}"`).join(", ");

                    const usersQuery = `
                        SELECT ${selectCols}
                        FROM "${tableName}"
                        WHERE ${whereSQL}
                        ORDER BY "${columns.id.columns[0]}" DESC
                        OFFSET :offset LIMIT :limit
                    `;

                    const users = await sequelize.query(usersQuery, {
                        type: QueryTypes.SELECT,
                        replacements
                    });

                    const mapped = users.map(row => {
                        const obj = {};

                        Object.keys(columns).forEach(key => {
                            const vals = (columns[key].columns || [])
                                .map(c => row[c])
                                .filter(Boolean);

                            obj[key] = vals.join(" ") || null;
                        });

                        return obj;
                    });

                    if (moduleValue == 1) {
                        for (let i = 0; i < mapped.length; i++) {
                            const targetUserId = users[i][columns.id.columns[0]];

                            const lastMessage = await models.message.findOne({
                                where: {
                                    [Op.or]: [
                                        { fromUserId: userId, toUserId: targetUserId },
                                        { fromUserId: targetUserId, toUserId: userId }
                                    ],
                                    messageType: "text"
                                },
                                order: [["createdAt", "DESC"]],
                                raw: true
                            });
                            if (lastMessage) {
                                mapped[i].lastMessage = lastMessage?.messageText || null;
                                mapped[i].lastMessageAt = lastMessage?.createdAt || null;
                                mapped[i].messageExits = true;
                            };
                        }
                    }
                    return {
                        status: "success",
                        currentPage,
                        totalPages,
                        totalRecords: count,
                        limit: totalRecords,
                        data: mapped
                    };

                } catch (error) {
                    console.log(error);
                    return { status: "error", message: error };
                }
            };


            /**
             * GET GROUPS
             */
            const getGroups = async ({ search = "", page = 1, limit = 10, userId = null }) => {
                try {
                    const { models } = configurationProvider.getConfig();

                    const group = models.group;
                    const GroupMember = models.GroupMember;

                    const where = {};

                    if (search.trim() !== "") {
                        where.name = { [Op.iLike]: `%${search.trim()}%` };
                    }

                    if (userId) {
                        const userGroups = await GroupMember.findAll({
                            where: { userId: Number(userId) },
                            attributes: ["groupId"],
                            raw: true
                        });

                        where.id = {
                            [Op.in]: userGroups.map(g => g.groupId)
                        };
                    }

                    const { rows, count } = await group.findAndCountAll({
                        where,
                        order: [["createdAt", "DESC"]],
                        offset: (page - 1) * limit,
                        limit
                    });

                    return {
                        status: "success",
                        data: rows,
                        pagination: {
                            currentPage: Number(page),
                            totalPages: Math.ceil(count / limit),
                            totalRecords: count,
                            limit
                        }
                    };

                } catch (error) {
                    return { status: "error", message: error };
                }
            };

            /**
             * CREATE GROUP
             */
            const createGroup = async ({ name, groupUsers = [], createdBy }) => {
                try {
                    const { models } = configurationProvider.getConfig();

                    if (!name) return { status: "error", message: "Group name required" };

                    const exists = await models.group.findOne({ where: { name } });

                    if (exists) return { status: "error", message: "Group name already exists" };

                    const group = await models.group.create({ name, createdBy });

                    await models.GroupMember.create({
                        groupId: group.id,
                        userId: createdBy
                    });

                    for (const id of groupUsers) {
                        await models.GroupMember.create({
                            groupId: group.id,
                            userId: id
                        });
                    }

                    return { status: "success", message: "Group created" };

                } catch (error) {
                    return { status: "error", message: error };
                }
            };

            /**
             * UPDATE GROUP
             */
            const updateGroup = async ({ groupId, name, groupUsers = [] }) => {
                try {
                    const { models } = configurationProvider.getConfig();

                    const group = await models.group.findOne({ where: { id: groupId } });

                    if (!group) {
                        return { status: "error", message: "Group not found" };
                    }

                    if (name) {
                        const duplicate = await models.group.findOne({
                            where: {
                                name,
                                id: { [Op.ne]: groupId }
                            }
                        });
                        if (duplicate) {
                            return { status: "error", message: "Group name already exists" };
                        }
                    }

                    await models.group.update(
                        { name },
                        { where: { id: groupId } }
                    );

                    const existing = await models.GroupMember.findAll({
                        where: { groupId },
                        attributes: ["userId"],
                        raw: true
                    });

                    const existingIds = existing.map(u => u.userId);
                    groupUsers = groupUsers.map(Number);

                    const toAdd = groupUsers.filter(id => !existingIds.includes(id));
                    const toRemove = existingIds.filter(id => !groupUsers.includes(id));

                    for (const id of toAdd) {
                        await models.GroupMember.create({ groupId, userId: id });
                    }

                    if (toRemove.length > 0) {
                        await models.GroupMember.destroy({
                            where: { groupId, userId: { [Op.in]: toRemove } }
                        });
                    }

                    return { status: "success", message: "Group updated" };

                } catch (error) {
                    return { status: "error", message: error };
                }
            };
            /**
             * Register Everything
             */
            configurationProvider.setConfig({
                syncDatabase,
                models: dbConnection.models,
                sequelize: dbConnection.sequelize,

                /** Services */
                getAllUsers,
                getGroups,
                createGroup,
                updateGroup,
                userModel: this.userModel
            });

            return configurationProvider.getConfig();

        } catch (error) {
            console.error("❌ Service Initialization Failed:", error);
            throw error;
        }
    }
};

module.exports = { Service, configurationProvider };
