/**
 * @file service.test.js
 * Tests for Service.init()
 */

const { Service, configurationProvider } = require("../src/services/ChatService");
require('dotenv').config();

// Mocks
jest.mock("../src/config/DatabaseConfig", () => ({
    dbConnection: {
        sequelize: { authenticate: jest.fn() },
        dbHandleConnection: jest.fn(),
        models: {
            users: {},
            group: {},
            GroupMember: {},
            message: {}
        }
    }
}));

jest.mock("../src/utils/fileManager", () => ({
    fileManager: {
        buildStorageEnv: jest.fn()
    }
}));

describe("Service.init()", () => {
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
                email: { columns: ["email"] },
                phoneNumber: { columns: ["phone"] }
            }
        };

        // Reset configuration provider before each test
        configurationProvider.setConfig({
            syncDatabase: null,
            models: null,
            sequelize: null,
            getAllUsers: null,
            getGroups: null,
            createGroup: null,
            updateGroup: null,
        });
    });

    test("should initialize service successfully", async () => {
        const { dbConnection } = require("../src/config/DatabaseConfig");
        const { fileManager } = require("../src/utils/fileManager");

        const spyValidate = jest.spyOn(service, "validateConfig").mockReturnValue(true);
        const spySync = jest.fn();
        service.init = jest.fn().mockResolvedValue({
            getAllUsers: expect.any(Function),
            getGroups: expect.any(Function),
            createGroup: expect.any(Function),
            updateGroup: expect.any(Function)
        });

        // Run service.init() which internally calls everything
        await service.init({
            dbconfig: mockDbConfig,
            userModel: mockUserModel
        });

        // Assertions
        expect(fileManager.buildStorageEnv).toHaveBeenCalled();
        expect(spyValidate).toHaveBeenCalled();
        expect(dbConnection.dbHandleConnection).toHaveBeenCalledWith(mockDbConfig);
        expect(dbConnection.sequelize.authenticate).toHaveBeenCalled();

        const config = configurationProvider.getConfig();
        expect(config.models).not.toBeNull();
        expect(config.sequelize).not.toBeNull();
        expect(typeof config.getAllUsers).toBe("function");
        expect(typeof config.getGroups).toBe("function");
        expect(typeof config.createGroup).toBe("function");
        expect(typeof config.updateGroup).toBe("function");
    });

    test("should throw error if DB config missing fields", async () => {
        const badDbConfig = {
            host: "",
            username: "",
            password: "",
            database: "",
            dialect: ""
        };

        expect(async () =>
            await service.init({
                dbconfig: badDbConfig,
                userModel: mockUserModel
            })
        ).toThrow("Database configuration error");
    });

    test("should throw if userModel is missing columns", async () => {
        const badUserModel = {
            name: "users",
            columns: {
                id: { columns: [] }, // ❌ missing required columns
            }
        };

        expect(async () =>
            await service.init({
                dbconfig: mockDbConfig,
                userModel: badUserModel
            })
        ).toThrow("User model configuration error");
    });

    test("configurationProvider must contain initialized services", async () => {
        await service.init({
            dbconfig: mockDbConfig,
            userModel: mockUserModel
        });

        const config = configurationProvider.getConfig();

        expect(config.getAllUsers).toBeDefined();
        expect(config.getGroups).toBeDefined();
        expect(config.createGroup).toBeDefined();
        expect(config.updateGroup).toBeDefined();
    });
});
