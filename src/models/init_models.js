const { DataTypes } = require("sequelize");
const _Message = require("./Message");
const _Group = require("./Group");
const _GroupMember = require("./GroupMember");

function initModels(sequelize) {
    const Message= _Message(sequelize, DataTypes);
    const group = _Group(sequelize, DataTypes);
    const GroupMember = _GroupMember(sequelize, DataTypes);

    // GroupMember ↔ group
    GroupMember.belongsTo(group, { foreignKey: "groupId", as: "groupsTogroup" });
    group.hasMany(GroupMember, { foreignKey: "groupId", as: "groupsTogroup" });

    // Message ↔ group
    Message.belongsTo(group, { foreignKey: "groupId", as: "groupsUser" });
    group.hasMany(Message, { foreignKey: "groupId", as: "userGroups" });


    // ---------------------------------------------
    // ✅ RETURN ALL INITIALIZED MODELS
    // ---------------------------------------------
    return {
        message:Message,
        group,
        GroupMember
    };
}

module.exports = initModels;
