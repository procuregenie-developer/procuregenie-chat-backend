module.exports = function (sequelize, DataTypes) {
    return sequelize.define('groupuserslines', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
        },
        groupId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        sequelize,
        tableName: 'groupuserslines',
        schema: 'public',
        timestamps: true
    });
};