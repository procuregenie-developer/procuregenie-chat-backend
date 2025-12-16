module.exports = function (sequelize, DataTypes) {
    return sequelize.define('groupsmaster', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        createdBy: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        sequelize,
        tableName: 'groupsmaster',
        schema: 'public',
        timestamps: true
    });
};