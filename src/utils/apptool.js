const fs = require('fs');
const path = require('path');

async function getAllDirectories(folderPath) {
    return fs.readdirSync(folderPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
};
// Function to remove all directories in a folder
async function removeDirectories(folderPath, directories) {
    await directories.forEach(dir => {
        const dirPath = path.join(folderPath, dir);
        fs.rmdirSync(dirPath, { recursive: true });
    });
};
const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
];
module.exports = {
    getAllDirectories,
    removeDirectories,
    ALLOWED_MIME_TYPES
};