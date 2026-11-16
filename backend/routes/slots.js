const { rankSlots } = require("../rules/scoring");
const express = require("express");
const router = express.Router();

const { readRooms } = require("../services/storage");
const { calculateSlots } = require("../rules/slots");

// GET /rooms/:id/slots
router.get("/:id/slots", async (req, res, next) => {
  try {
    const rooms = await readRooms();

    const room = rooms.find(
      (item) => item.roomId === req.params.id
    );

    if (!room) {
      return res.status(404).json({
        error: "방을 찾을 수 없습니다."
      });
    }

    const slots = calculateSlots(room);

    res.json({
      roomId: room.roomId,
      minMinutes: room.minMinutes,
      memberCount: room.members.length,
      slots
    });
  } catch (error) {
    next(error);
  }
});

// 공강 시간대 추천 API
router.get("/:id/recommendations", async (req, res, next) => {
    try {
        const rooms = await readRooms();
        const room = rooms.find(
            room => room.roomId === req.params.id
        );

        if (!room) {
            return res.status(404).json({
                error: "방을 찾을 수 없습니다."
            });
        }

        const slots = calculateSlots(room);
        const recommendations = rankSlots(slots, room.members);

        res.json({
            roomId: room.roomId,
            memberCount: room.members.length,
            recommendations
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
