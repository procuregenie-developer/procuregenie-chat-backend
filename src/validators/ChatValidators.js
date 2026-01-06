const { body, query, validationResult, param } = require("express-validator");

const validatorHandler = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            status: "error",
            message: "Validation failed",
            errors: errors.array()
        });
    }
    next();
};
const validatorUpdateGroup = [

    // groupId is required and must be integer
    body("groupId")
        .notEmpty().withMessage("groupId is required.")
        .isInt({ min: 1 }).withMessage("groupId must be a valid positive integer."),

    // name is optional
    body("name")
        .optional()
        .isString().withMessage("Group name must be a string.")
        .isLength({ max: 100 }).withMessage("Group name cannot exceed 100 characters."),

    // groupUsers must be array
    body("groupUsers")
        .optional()
        .isArray().withMessage("groupUsers must be an array."),

    // Validate each userId in groupUsers
    body("groupUsers.*")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Each userId inside groupUsers must be a positive integer."),
    validatorHandler
];
const validateGetMessages = [
    query("fromUserId")
        .optional()
        .isInt({ min: 1 }).withMessage("fromUserId must be a positive integer"),

    query("toUserId")
        .optional()
        .isInt({ min: 1 }).withMessage("toUserId must be a positive integer"),

    query("groupId")
        .optional()
        .isInt({ min: 1 }).withMessage("groupId must be a positive integer"),

    query("page")
        .optional()
        .isInt({ min: 1 }).withMessage("page must be a positive integer"),

    query("limit")
        .optional()
        .isInt({ min: 1 }).withMessage("limit must be a positive integer"),

    query("search")
        .optional()
        .isString().withMessage("search must be a string"),
    validatorHandler
];
const validatorCreateGroup = [
    // name is required
    body("name")
        .notEmpty()
        .withMessage("Group name is required.")
        .isString()
        .withMessage("Group name must be a string.")
        .isLength({ max: 100 })
        .withMessage("Group name cannot exceed 100 characters."),

    // groupUsers is optional but must be an array of integers
    body("groupUsers")
        .optional()
        .isArray()
        .withMessage("groupUsers must be an array."),

    body("groupUsers.*")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Each userId inside groupUsers must be a positive integer."),
    validatorHandler
];
const validatorGetGroups = [
    // Validate "search" (optional)
    query("search")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Search must be less than 100 characters"),

    // Validate "page"
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),

    // Validate "limit"
    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),

    // Validate "userId"
    query("userId")
        .optional()
        .isInt({ min: 1 })
        .withMessage("User ID must be a valid positive integer"),
    validatorHandler
];
const validatorGetUsers = [
    // currentPage
    query("currentPage")
        .optional()
        .isInt({ min: 1 })
        .withMessage("currentPage must be a positive integer"),

    // totalRecords
    query("totalRecords")
        .optional()
        .isInt({ min: 1, max: 200 })
        .withMessage("totalRecords must be between 1 and 200"),

    // search
    query("search")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("search must be less than 100 characters"),

    // moduleValue → only 0 or 1 allowed (your code uses 0 = all, 1 = chat)
    query("moduleValue")
        .optional()
        .isInt({ min: 0, max: 1 })
        .withMessage("moduleValue must be 0 or 1"),

    // userId → if provided, must be integer
    query("userId")
        .optional()
        .isInt({ min: 1 })
        .withMessage("userId must be a valid positive integer"),
    validatorHandler
];
const validateGetGroupManageUsers = [
    // Validate groupId parameter
    param('groupId')
        .exists().withMessage('Group ID is required')
        .isInt({ min: 1 }).withMessage('Group ID must be a positive integer')
        .toInt(),

    // Validate assigned query parameter
    query('assigned')
        .exists().withMessage('Assigned parameter is required')
        .isIn(['0', '1']).withMessage('Assigned must be either 0 (assigned users) or 1 (unassigned users)')
        .toInt(),

    // Validate search query parameter
    query('search')
        .optional()
        .trim()
        .isString().withMessage('Search must be a string')
        .isLength({ max: 100 }).withMessage('Search cannot exceed 100 characters')
        .escape(), // Sanitize to prevent XSS

    // Validate page query parameter
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer')
        .default(1)
        .toInt(),

    // Validate limit query parameter
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
        .default(10)
        .toInt(),
    validatorHandler
];
const assignGroupMembersValidator = [
    param("groupId")
        .exists().withMessage("groupId is required")
        .isInt({ gt: 0 }).withMessage("groupId must be a positive integer"),

    body("unlinkAssigned")
        .optional()
        .isArray().withMessage("unlinkAssigned must be an array")
        .custom((arr) => {
            if (!arr.every(Number.isInteger)) {
                throw new Error("unlinkAssigned must contain only integers");
            }
            return true;
        }),

    body("notAssigned")
        .optional()
        .isArray().withMessage("notAssigned must be an array")
        .custom((arr) => {
            if (!arr.every(Number.isInteger)) {
                throw new Error("notAssigned must contain only integers");
            }
            return true;
        }),
    body("groupName")
        .optional()
        .isString().withMessage("Group name must be a string"),
    validatorHandler
];
module.exports = {
    validatorUpdateGroup,
    validatorCreateGroup,
    validatorGetGroups,
    validatorGetUsers,
    validateGetMessages,
    validateGetGroupManageUsers,
    assignGroupMembersValidator
};