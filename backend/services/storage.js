
const fs = require("node:fs/promises");
const path = require("node:path");

const FILE_PATH = path.join(__dirname, "../data/rooms.json");

// 저장된 방 목록 읽기
async function readRooms() {
    try {
        const text = await fs.readFile(FILE_PATH, "utf8");
        return JSON.parse(text);
    } catch (error) {
        if (error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
}

// 방 목록 저장
async function writeRooms(rooms) {
    await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
    await fs.writeFile(
        FILE_PATH,
        JSON.stringify(rooms, null, 2),
        "utf8"
    );
}

module.exports = { readRooms, writeRooms };
