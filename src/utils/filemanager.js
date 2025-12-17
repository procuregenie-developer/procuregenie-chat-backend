// fileManager.js
const fs = require("fs").promises;
const path = require("path");
const { removeDirectories, getAllDirectories } = require("./apptool");

/**
 * Safe File Manager
 *
 * - fileLocation is always an absolute normalized path (resolved at startup)
 * - Every public path is validated to remain inside fileLocation (prevents path traversal)
 * - getAllFiles reads only files (skips directories) unless recursive=true
 */

const fileManager = {
    // configure a base uploads folder (will be resolved to absolute path)
    fileLocation: path.resolve(process.cwd(), "./public/uploads"),

    // Ensure a path is inside base dir
    _resolveAndValidate(targetPath) {
        const resolved = path.resolve(this.fileLocation, targetPath || "");
        // Normalize to prevent weird path segments
        const normalizedBase = this.fileLocation.endsWith(path.sep)
            ? this.fileLocation
            : this.fileLocation + path.sep;
        const normalizedResolved = resolved.endsWith(path.sep) ? resolved : resolved + path.sep;

        // Check that resolved path starts with base path (prevents escape)
        if (!normalizedResolved.startsWith(normalizedBase)) {
            throw new Error("Invalid path - outside of upload directory");
        }
        return resolved;
    },

    /************ Directory helpers ************/
    async getAllDirs({ locationPath = "" } = {}) {
        const target = this._resolveAndValidate(locationPath);
        // Delegate to external util (should also be async)
        return await getAllDirectories(target);
    },

    async removeDirs({ locationPath = "" } = {}) {
        const target = this._resolveAndValidate(locationPath);
        const dirs = await this.getAllDirs({ locationPath });
        return await removeDirectories(target, dirs);
    },

    async removeDir(dirPath) {
        const target = this._resolveAndValidate(dirPath);
        // rm with recursive true and force to be safe
        await fs.rm(target, { recursive: true, force: true });
    },

    async addDirs({ uploadpath = "", dirs = [] } = {}) {
        const base = this._resolveAndValidate(uploadpath);
        for (const d of dirs) {
            const full = path.join(base, d);
            const resolved = path.resolve(full);
            // ensure resolved is still inside base
            if (!resolved.startsWith(base)) throw new Error("Invalid subdirectory path");
            await fs.mkdir(resolved, { recursive: true });
        }
    },

    async buildStorageEnv() {
        try {
            await fs.mkdir(this.fileLocation, { recursive: true });
            await this.addDirs({ uploadpath: "", dirs: ["messagesdocs"] });
        } catch (err) {
            // bubble up so caller can decide
            console.error("fileManager.buildStorageEnv error:", err.message);
            throw err;
        }
    },

    /************ File read/write helpers ************/
    /**
     * Read a file and return buffer or encoded string.
     * format: 'base64'|'utf8'|null  (null returns Buffer)
     */
    async readFileToBase64(filePath, format = "base64") {
        const resolved = this._resolveAndValidate(filePath);
        const stat = await fs.stat(resolved).catch(() => null);
        if (!stat || !stat.isFile()) throw new Error("File does not exist or is not a file");
        const buffer = await fs.readFile(resolved);
        if (!format) return buffer;
        return buffer.toString(format);
    },

    /**
     * List files in a directory.
     * - dirPath: relative to fileLocation (e.g. "messagesdocs/abc")
     * - format: 'base64' | 'utf8' | null (Buffer)
     * - recursive: whether to recurse into subdirectories
     *
     * Returns array of { name: relativePathFromDir, content }
     */
    async getAllFiles(dirPath = "", format = "base64", recursive = false) {
        const baseDir = this._resolveAndValidate(dirPath);
        const results = [];

        // If directory doesn't exist, return empty list (no throw)
        const stat = await fs.stat(baseDir).catch(() => null);
        if (!stat || !stat.isDirectory()) return results;

        // Helper to walk
        const walk = async (currentDir, relativePrefix = "") => {
            const entries = await fs.readdir(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                const entryPath = path.join(currentDir, entry.name);
                const relName = path.join(relativePrefix, entry.name);
                if (entry.isDirectory()) {
                    if (recursive) {
                        await walk(entryPath, relName);
                    } else {
                        // skip directories when not recursive
                        continue;
                    }
                } else if (entry.isFile()) {
                    const content = await fs.readFile(entryPath);
                    results.push({
                        name: relName.replace(/\\/g, "/"), // normalize for cross-platform
                        content: format ? content.toString(format) : content
                    });
                }
            }
        };

        await walk(baseDir, "");
        return results;
    },

    /**
     * Write a file asynchronously.
     * - location: absolute or relative path under fileLocation. If relative, validated/resolved.
     * - data: Buffer | string
     */
    async addFiles({ data, location }) {
        if (!location) throw new Error("Location is required");
        // allow both absolute within base and relative paths
        let resolved;
        try {
            resolved = this._resolveAndValidate(location);
        } catch (e) {
            // maybe user passed absolute path inside base (without relative segments)
            // try resolve absolute and validate
            const alt = path.resolve(location);
            if (!alt.startsWith(this.fileLocation)) throw e;
            resolved = alt;
        }

        // ensure parent dir exists
        const parent = path.dirname(resolved);
        await fs.mkdir(parent, { recursive: true });
        // write file (overwrite)
        await fs.writeFile(resolved, data);
        return resolved;
    },

    /**
     * Remove all files inside a directory (non-recursive for directories).
     * - locationPath relative to base or empty for base
     */
    async removeAllFiles({ locationPath = "" } = {}) {
        const dir = this._resolveAndValidate(locationPath);
        const stat = await fs.stat(dir).catch(() => null);
        if (!stat || !stat.isDirectory()) return;
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const entryPath = path.join(dir, entry.name);
            if (entry.isFile()) {
                await fs.unlink(entryPath).catch(err => {
                    console.error("failed to delete file:", entryPath, err.message);
                });
            }
        }
    },

    /**
     * Convert data to Buffer using given encoding/type
     * type: 'base64'|'utf8' etc.
     */
    async convertType({ data, type = "utf8" } = {}) {
        if (Buffer.isBuffer(data)) return data;
        return Buffer.from(String(data), type);
    },

    async removeFile(filePath) {
        const target = this._resolveAndValidate(filePath);
        await fs.unlink(target);
    }
};

module.exports = { fileManager };
