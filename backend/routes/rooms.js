
const express = require("express");
const { randomBytes } = require("node:crypto");
const { readRooms, writeRooms } = require("../services/storage");

const router = express.Router();

// POST /rooms : 새로운 방 생성
router.post("/", async (req, res, next) => {
    try {
        const { name, minMinutes = 60 } = req.body || {};

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                error: "방 이름을 입력해주세요."
            });
        }

        if (
            !Number.isInteger(minMinutes) ||
            minMinutes < 15 ||
            minMinutes > 480
        ) {
            return res.status(400).json({
                error: "최소 회의 시간은 15~480분 사이의 정수여야 합니다."
            });
        }

        const rooms = await readRooms();

        let roomId;
        do {
            roomId = randomBytes(6).toString("hex");
        } while (rooms.some(room => room.roomId === roomId));

        const room = {
            roomId,
            name: name.trim(),
            minMinutes,
            members: [],
            confirmed: null,
            plan: null
        };

        rooms.push(room);
        await writeRooms(rooms);

        res.status(201).json({
            message: "방 생성 성공",
            roomId,
            room,
            sharePath: `/rooms/${roomId}`
        });
    } catch (error) {
        next(error);
    }
});

// GET /rooms/:id : 방 조회
router.get("/:id", async (req, res, next) => {
    try {
        const rooms = await readRooms();

        const room = rooms.find(
            room => room.roomId === req.params.id
        );

        if (!room) {
            return res.status(404).json({
                error: "존재하지 않는 방입니다."
            });
        }

        res.json(room);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
