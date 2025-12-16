/**
 * @file apiServices.test.js
 * Full tests for Service.init() and registered services.
 */

const { Service, configurationProvider } = require("../src/services/ChatService");
require('dotenv').config();

// 🌟 Mock fileManager
jest.mock("../src/utils/fileManager", () => ({
    fileManager: {
        buildStorageEnv: jest.fn().mockResolvedValue(true)
    }
}));

// 🌟 Mock Sequelize + dbConnection
jest.mock("../src/config/DatabaseConfig", () => {
    return {
        dbConnection: {
            sequelize: {
                authenticate: jest.fn().mockResolvedValue(true),
                sync: jest.fn().mockResolvedValue(true),
                query: jest.fn()
            },
            dbHandleConnection: jest.fn(),
            models: {
                users: { findAll: jest.fn(), findOne: jest.fn() },
                group: {
                    findOne: jest.fn(),
                    findAll: jest.fn(),
                    findAndCountAll: jest.fn(),
                    create: jest.fn(),
                    update: jest.fn()
                },
                GroupMember: {
                    findAll: jest.fn(),
                    create: jest.fn(),
                    destroy: jest.fn()
                },
                message: {
                    findAll: jest.fn(),
                    findOne: jest.fn()
                }
            }
        }
    };
});

const { dbConnection } = require("../src/config/DatabaseConfig");
const { fileManager } = require("../src/utils/fileManager");

describe("Service.init() Full Test Suite", () => {

    let service;
    let mockDbConfig;
    let mockUserModel;

    beforeEach(() => {
        service = new Service();

        mockDbConfig = {
            host: process.env.host || "localhost",
            username: process.env.username,
            password: process.env.password,
            database: process.env.database,
            dialect: "postgres",
            port: process.env.port || 5432
        };

        mockUserModel = {
            name: "users",
            columns: {
                id: { columns: ["id"] },
                username: { columns: ["firstName", "lastName"] },
                email: { columns: ["email"] }
            }
        };

        // RESET CONFIG STORAGE
        configurationProvider.setConfig({
            syncDatabase: null,
            models: null,
            sequelize: null,
            getAllUsers: null,
            getGroups: null,
            createGroup: null,
            updateGroup: null
        });
    });

    // --------------------------------------------------------------------
    // TEST INIT
    // --------------------------------------------------------------------

    test("Service.init() should initialize and return all services", async () => {
        await service.init({
            dbconfig: mockDbConfig,
            userModel: mockUserModel
        });

        expect(fileManager.buildStorageEnv).toHaveBeenCalled();
        expect(dbConnection.dbHandleConnection).toHaveBeenCalledWith(mockDbConfig);
        expect(dbConnection.sequelize.authenticate).toHaveBeenCalled();
        expect(dbConnection.sequelize.sync).toHaveBeenCalled();

        const config = configurationProvider.getConfig();

        expect(typeof config.getAllUsers).toBe("function");
        expect(typeof config.getGroups).toBe("function");
        expect(typeof config.createGroup).toBe("function");
        expect(typeof config.updateGroup).toBe("function");
    });

    test("Service.init() should throw for missing DB config", async () => {
        await expect(service.init({
            dbconfig: {},
            userModel: mockUserModel
        })).rejects.toThrow("Database Config Missing");
    });

    test("Service.init() should throw for invalid userModel", async () => {
        const badUserModel = { name: "users", columns: { id: { columns: [] } } };

        await expect(service.init({
            dbconfig: mockDbConfig,
            userModel: badUserModel
        })).rejects.toThrow("UserModel Missing column");
    });

    // --------------------------------------------------------------------
    // SERVICE - getAllUsers
    // --------------------------------------------------------------------

    test("getAllUsers() should return paginated users", async () => {
        await service.init({ dbconfig: mockDbConfig, userModel: mockUserModel });

        dbConnection.sequelize.query.mockResolvedValueOnce([{ count: 1 }]); // countQuery
        dbConnection.sequelize.query.mockResolvedValueOnce([
            { id: 1, firstName: "John", lastName: "Doe", email: "john@example.com" }
        ]); // usersQuery

        const res = await configurationProvider.getConfig().getAllUsers({
            currentPage: 1,
            totalRecords: 10,
            search: "",
            userId: 1
        });

        expect(res.status).toBe("success");
        expect(res.data.length).toBe(1);
        expect(res.data[0].username).toBe("John Doe");
    });

    // --------------------------------------------------------------------
    // SERVICE - getGroups
    // --------------------------------------------------------------------

    test("getGroups() should return filtered groups", async () => {
        await service.init({ dbconfig: mockDbConfig, userModel: mockUserModel });

        dbConnection.models.group.findAndCountAll.mockResolvedValue({
            rows: [{ id: 1, name: "Group A" }],
            count: 1
        });

        const res = await configurationProvider.getConfig().getGroups({
            search: "A",
            page: 1,
            limit: 10
        });

        expect(res.status).toBe("success");
        expect(res.data.length).toBe(1);
    });

    // --------------------------------------------------------------------
    // SERVICE - createGroup
    // --------------------------------------------------------------------

    test("createGroup() should create a new group", async () => {
        await service.init({ dbconfig: mockDbConfig, userModel: mockUserModel });

        dbConnection.models.group.findOne.mockResolvedValue(null);
        dbConnection.models.group.create.mockResolvedValue({ id: 10 });
        dbConnection.models.GroupMember.create.mockResolvedValue(true);

        const res = await configurationProvider.getConfig().createGroup({
            name: "New Group",
            groupUsers: [2, 3],
            createdBy: 1
        });

        expect(res.status).toBe("success");
        expect(dbConnection.models.GroupMember.create).toHaveBeenCalledTimes(3);
    });

    // --------------------------------------------------------------------
    // SERVICE - updateGroup
    // --------------------------------------------------------------------

    test("updateGroup() should update group details", async () => {
        await service.init({ dbconfig: mockDbConfig, userModel: mockUserModel });

        dbConnection.models.group.findOne.mockResolvedValue({ id: 1, name: "Old" });
        dbConnection.models.group.update.mockResolvedValue(true);
        dbConnection.models.GroupMember.findAll.mockResolvedValue([
            { userId: 1 },
            { userId: 2 }
        ]);
        dbConnection.models.GroupMember.create.mockResolvedValue(true);
        dbConnection.models.GroupMember.destroy.mockResolvedValue(true);

        const res = await configurationProvider.getConfig().updateGroup({
            groupId: 1,
            name: "Updated",
            groupUsers: [2, 3]
        });
        expect(res.status).toBe("success");
        expect(dbConnection.models.GroupMember.create).toHaveBeenCalledTimes(1);
        expect(dbConnection.models.GroupMember.destroy).toHaveBeenCalledTimes(1);
    });
});
