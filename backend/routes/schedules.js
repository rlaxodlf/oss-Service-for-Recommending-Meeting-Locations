
const express = require("express");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const { readRooms, writeRooms } = require("../services/storage");
const { validateSchedule } = require("../rules/validation");

const router = express.Router();
// 프론트엔드 데이터를 백엔드 형식으로 변환
const DAY_MAP = {
    "월": "mon",
    "화": "tue",
    "수": "wed",
    "목": "thu",
    "금": "fri",
    "토": "sat",
    "일": "sun",
    "mon": "mon",
    "tue": "tue",
    "wed": "wed",
    "thu": "thu",
    "fri": "fri",
    "sat": "sat",
    "sun": "sun"
};

const PREFERENCE_MAP = {
    "오전": "morning",
    "오후": "afternoon",
    "저녁": "evening",
    "morning": "morning",
    "afternoon": "afternoon",
    "evening": "evening"
};

function normalizeSchedule(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return data;
    }

    return {
        ...data,

        classes: Array.isArray(data.classes)
            ? data.classes.map(cls => {
                if (!cls || typeof cls !== "object" || Array.isArray(cls)) {
                    return cls;
                }

                return {
                    ...cls,
                    day: DAY_MAP[cls.day] ?? cls.day,
                    building: cls.building ?? cls.room
                };
            })
            : data.classes,

        preferred: Array.isArray(data.preferredTimes ?? data.preferred)
            ? (data.preferredTimes ?? data.preferred).map(
                p => PREFERENCE_MAP[p] ?? p
            )
            : (data.preferredTimes ?? data.preferred ?? [])
    };
}

// POST /rooms/:id/schedules
// 팀원 시간표 등록
router.post("/:id/schedules", async (req, res, next) => {
    try {
        const normalizedData = normalizeSchedule(req.body);
        const errors = validateSchedule(normalizedData);

        if (errors.length > 0) {
            return res.status(400).json({
                message: "시간표 입력 오류",
                errors
            });
        }

        const rooms = await readRooms();
        const room = rooms.find(r => r.roomId === req.params.id);

        if (!room) {
            return res.status(404).json({
                error: "존재하지 않는 방입니다."
            });
        }

        const nickname = normalizedData.nickname.trim();

        if (room.members.some(m => m.nickname === nickname)) {
            return res.status(409).json({
                error: "이미 사용 중인 닉네임입니다."
            });
        }

        const scheduleId = randomUUID();
        const editToken = randomBytes(32).toString("hex");
        const editTokenHash = createHash("sha256")
            .update(editToken)
            .digest("hex");

        const member = {
                scheduleId,
                nickname,
                classes: normalizedData.classes.map(cls => ({
                    day: cls.day,
                    start: cls.start,
                    end: cls.end,
                    building: cls.building.trim()
        })),
    preferred: normalizedData.preferred,
    editTokenHash
};

        room.members.push(member);
        await writeRooms(rooms);

        res.status(201).json({
            message: "시간표 등록 성공",
            scheduleId,
            editToken,
            member: {
                scheduleId,
                nickname: member.nickname,
                classes: member.classes,
                preferred: member.preferred
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET /rooms/:id/schedules
// 등록된 시간표 목록 조회
router.get("/:id/schedules", async (req, res, next) => {
    try {
        const rooms = await readRooms();
        const room = rooms.find(r => r.roomId === req.params.id);

        if (!room) {
            return res.status(404).json({
                error: "존재하지 않는 방입니다."
            });
        }

        const schedules = room.members.map(member => ({
            scheduleId: member.scheduleId,
            nickname: member.nickname,
            classes: member.classes,
            preferred: member.preferred
        }));

        res.json({
            roomId: room.roomId,
            schedules
        });
    } catch (error) {
        next(error);
    }
});


const { timingSafeEqual } = require("node:crypto");

// 수정 토큰 검증 함수
function verifyEditToken(token, storedHash) {
    if (
        typeof token !== "string" ||
        !/^[a-f0-9]{64}$/.test(token) ||
        typeof storedHash !== "string" ||
        !/^[a-f0-9]{64}$/.test(storedHash)
    ) {
        return false;
    }

    const tokenHash = createHash("sha256")
        .update(token)
        .digest();

    const expectedHash = Buffer.from(storedHash, "hex");

    return timingSafeEqual(tokenHash, expectedHash);
}

// PATCH /rooms/:id/schedules/:scheduleId
// 시간표 수정
router.patch("/:id/schedules/:scheduleId", async (req, res, next) => {
    try {
        const token = req.get("X-Edit-Token");

        const rooms = await readRooms();
        const room = rooms.find(r => r.roomId === req.params.id);

        if (!room) {
            return res.status(404).json({
                error: "존재하지 않는 방입니다."
            });
        }

        const member = room.members.find(
            m => m.scheduleId === req.params.scheduleId
        );

        if (!member) {
            return res.status(404).json({
                error: "존재하지 않는 시간표입니다."
            });
        }

        if (!verifyEditToken(token, member.editTokenHash)) {
            return res.status(403).json({
                error: "시간표 수정 권한이 없습니다."
            });
        }

        // 변경할 값과 기존 값을 합쳐 전체 시간표 검증
        const updated = {
            nickname: req.body?.nickname ?? member.nickname,
            classes: req.body?.classes ?? member.classes,
            preferred: req.body?.preferred ?? member.preferred
        };

        const errors = validateSchedule(updated);

        if (errors.length > 0) {
            return res.status(400).json({
                message: "시간표 입력 오류",
                errors
            });
        }

        const nickname = updated.nickname.trim();

        if (
            room.members.some(
                m => m.scheduleId !== member.scheduleId &&
                     m.nickname === nickname
            )
        ) {
            return res.status(409).json({
                error: "이미 사용 중인 닉네임입니다."
            });
        }

        member.nickname = nickname;
        member.classes = updated.classes.map(cls => ({
            day: cls.day,
            start: cls.start,
            end: cls.end,
            building: cls.building.trim()
        }));
        member.preferred = updated.preferred;

        await writeRooms(rooms);

        res.json({
            message: "시간표 수정 성공",
            member: {
                scheduleId: member.scheduleId,
                nickname: member.nickname,
                classes: member.classes,
                preferred: member.preferred
            }
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /rooms/:id/schedules/:scheduleId
// 시간표 삭제
router.delete("/:id/schedules/:scheduleId", async (req, res, next) => {
    try {
        const token = req.get("X-Edit-Token");

        const rooms = await readRooms();
        const room = rooms.find(r => r.roomId === req.params.id);

        if (!room) {
            return res.status(404).json({
                error: "존재하지 않는 방입니다."
            });
        }

        const memberIndex = room.members.findIndex(
            m => m.scheduleId === req.params.scheduleId
        );

        if (memberIndex === -1) {
            return res.status(404).json({
                error: "존재하지 않는 시간표입니다."
            });
        }

        const member = room.members[memberIndex];

        if (!verifyEditToken(token, member.editTokenHash)) {
            return res.status(403).json({
                error: "시간표 삭제 권한이 없습니다."
            });
        }

        room.members.splice(memberIndex, 1);
        await writeRooms(rooms);

        res.json({
            message: "시간표 삭제 성공",
            scheduleId: req.params.scheduleId
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
