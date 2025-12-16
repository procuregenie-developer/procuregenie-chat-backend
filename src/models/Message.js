module.exports = (sequelize, DataTypes) => {
    const UsersMessagesMaster = sequelize.define('usersmessagesmaster', {
        fromUserId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        toUserId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        messageType: {
            type: DataTypes.ENUM('doc', 'text'),
            allowNull: true
        },
        messageText: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        groupId: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    }, {
        tableName: 'usersmessagesmaster',
        timestamps: true
    });
    return UsersMessagesMaster;
}