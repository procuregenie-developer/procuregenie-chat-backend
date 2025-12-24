// ============================================================================
// 📌 IMPORTS (Single unified import block)
// ============================================================================
const path = require("path");
const { Op } = require("sequelize");

const { fileManager } = require("../utils/filemanager");
const { getUserMessagesMaster, getUserInfo } = require("../utils/helper");

// Local package services (chatbortbackend / ChatService)
const { configurationProvider } = require("../services/ChatService");


// ============================================================================
// 📌 GET GROUPS CONTROLLER
// ============================================================================
/**
 * @route   GET /groups
 * @desc    Fetch groups with pagination and search
 */
const getGroups = async (req, res) => {
    try {
        let { search = "", page = 1, limit = 10 } = req.query;

        let response = await configurationProvider.getConfig().getGroups?.({
            search,
            page,
            limit,
            userId: req?.user_data?.user_id,
        });

        if (response.status === "success") {
            return res.status(200).json(response);
        }

        return res.status(400).json(response);

    } catch (error) {
        console.error("Get Groups Error:", error);

        return res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};


const getAllUsers = async (req, res) => {
    try {
        let { currentPage = 1, totalRecords = 10, search = "", moduleValue = 0 } = req.query;
        let config = configurationProvider.getConfig?.();
        let response = await config.getAllUsers?.({ currentPage, totalRecords, search, moduleValue, userId: req?.user_data?.user_id });
        return res.status(200).json(response);
    } catch (error) {
        console.error("Error fetching users:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
};
// ============================================================================
// 📌 CREATE GROUP CONTROLLER
// ============================================================================
/**
 * @route   POST /groups
 * @desc    Create a new group
 */
const createGroup = async (req, res) => {
    try {
        const { name, groupUsers } = req.body;
        console.log(req?.user_data);
        let response = await configurationProvider.getConfig().createGroup?.({
            name,
            groupUsers,
            createdBy: req?.user_data?.user_id,
        });

        if (response?.status === "success") {
            return res.status(201).json(response);
        }

        return res.status(400).json(response);

    } catch (error) {
        console.error("Create Group Error:", error);

        return res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};



// ============================================================================
// 📌 UPDATE GROUP CONTROLLER
// ============================================================================
/**
 * @route   PATCH /groups/:groupId
 * @desc    Update existing group
 */
const updateGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name, groupUsers } = req.body;

        let response = await configurationProvider.getConfig().updateGroup?.({
            groupId,
            name,
            groupUsers,
        });

        if (response?.status === "success") {
            return res.status(200).json(response);
        }

        return res.status(400).json(response);

    } catch (error) {
        console.error("Update Group Error:", error);

        return res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};



// ============================================================================
// 📌 GET MESSAGES CONTROLLER
// ============================================================================
/**
 * @route   GET /messages
 * @desc    Fetch direct chat messages or group messages
 * @query   fromUserId, toUserId, groupId, search, page, limit
 */
const getMessages = async (req, res) => {
    try {
        let messageModel = getUserMessagesMaster();
        let {
            fromUserId,
            toUserId,
            groupId,
            search,
            page = 1,
            limit = 10
        } = req.query;

        page = parseInt(page);
        limit = parseInt(limit);
        const offset = (page - 1) * limit;

        const whereClause = {};

        // Group Chat Case
        if (groupId) {
            whereClause.groupId = Number(groupId);
        }
        // Direct Chat Case
        else if (fromUserId && toUserId) {
            fromUserId = Number(fromUserId);
            toUserId = Number(toUserId);

            whereClause[Op.or] = [
                { fromUserId, toUserId },
                { fromUserId: toUserId, toUserId: fromUserId }
            ];
        }
        else {
            return res.status(400).json({
                status: "error",
                message: "Either groupId or (fromUserId & toUserId) is required."
            });
        }

        if (search?.trim()) {
            whereClause.messageText = { [Op.iLike]: `%${search.trim()}%` };
        }

        const { rows: messages, count: totalRecords } =
            await messageModel.findAndCountAll({
                where: whereClause,
                order: [["id", "DESC"]],
                offset,
                limit
            });

        const results = [];

        for (const msg of messages) {
            let files = []
            if (msg.messageType == "doc") {
                const messageDir = path.join("messagesdocs", String(msg.id));
                files = await fileManager.getAllFiles(messageDir, "base64");
            }

            const sender = await getUserInfo(msg.fromUserId);

            results.push({
                ...msg.toJSON(),
                files,
                senderName: sender ? sender.username : null,
            });
        }

        return res.status(200).json({
            status: "success",
            data: results,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalRecords / limit),
                totalRecords,
                limit,
            },
        });

    } catch (error) {
        console.error("Get Messages Error:", error);
        return res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};



// ============================================================================
// 📌 EXPORT ALL CONTROLLERS IN ONE OBJECT
// ============================================================================
module.exports = {
    fetchGroups: getGroups,
    createGroup: createGroup,
    updateGroup: updateGroup,
    fetchMessages: getMessages,
    fetchUsers: getAllUsers
};
