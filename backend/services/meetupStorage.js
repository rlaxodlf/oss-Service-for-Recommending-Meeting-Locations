// 일반 모드 약속 방 저장. 학생 모드의 rooms.json과 파일을 나눠 서로 영향을 주지 않게 한다.

const fs = require("node:fs/promises");
const path = require("node:path");

const FILE_PATH = path.join(__dirname, "../data/meetups.json");

async function readMeetups() {
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

async function writeMeetups(meetups) {
    await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
    await fs.writeFile(FILE_PATH, JSON.stringify(meetups, null, 2), "utf8");
}

module.exports = { readMeetups, writeMeetups };
