// 일반 모드(친구 약속) API
// 참여자가 출발역을 넣으면 모두 오기 좋은 핫플 역을, 일정을 넣으면 함께 비는 시간을 추천한다.

const express = require("express");
const { randomBytes, randomUUID } = require("node:crypto");
const { readMeetups, writeMeetups } = require("../services/meetupStorage");
const { issueEditToken, verifyEditToken } = require("../services/editToken");
const { validateMember } = require("../rules/meetupValidation");
const { rankMeetingStations } = require("../rules/midpoint");
const { findCommonFreeTimes } = require("../rules/freeTime");
const { buildNetwork, searchFrom, shortestTimes, routeLegs } = require("../rules/route");
const { tallyVotes, majorityChoice } = require("../rules/votes");
const { stations } = require("../data/stations.json");
const { edges } = require("../data/edges.json");

const router = express.Router();
const stationById = new Map(stations.map(s => [s.id, s]));
const stationIds = [...stationById.keys()];

// 지하철 노선망은 서버가 켜질 때 한 번만 만들고, 출발역별 탐색 결과는 한 번 계산하면 기억해 둔다
const network = buildNetwork(edges);
const searchCache = new Map();
const nameOf = id => stationById.get(id)?.name ?? id;

// 출발역 → 각 역까지 { minutes, transfers, legs }. legs는 역 이름으로 바꾼 길 안내
function timesFrom(station) {
    if (!searchCache.has(station.id)) {
        const search = searchFrom(network, station.id);
        searchCache.set(station.id, { search, times: shortestTimes(network, station.id, search) });
    }
    const { search, times } = searchCache.get(station.id);
    return {
        get(id) {
            const t = times.get(id);
            if (!t) return undefined;
            const legs = routeLegs(search, id);
            return { ...t, legs: legs && legs.map(l => ({ ...l, from: nameOf(l.from), to: nameOf(l.to) })) };
        }
    };
}

// 응답에서 토큰 해시를 빼고 역 이름을 붙인다
function publicMember(m) {
    return {
        memberId: m.memberId,
        nickname: m.nickname,
        stationId: m.stationId,
        stationName: stationById.get(m.stationId)?.name ?? m.stationId,
        hasSchedule: m.hasSchedule,
        busy: m.busy,
        preferred: m.preferred
    };
}

function publicMeetup(meetup) {
    return {
        meetupId: meetup.meetupId,
        name: meetup.name,
        minMinutes: meetup.minMinutes,
        members: meetup.members.map(publicMember),
        votes: meetup.votes ?? {}
    };
}

// 입력값에서 저장할 필드만 골라낸다. busy를 보내지 않으면 일정을 넣지 않은 것으로 본다
function memberFields(body) {
    const hasSchedule = Array.isArray(body.busy);
    return {
        nickname: body.nickname.trim(),
        stationId: body.stationId,
        hasSchedule,
        busy: hasSchedule
            ? body.busy.map(b => ({ day: b.day, start: b.start, end: b.end }))
            : [],
        preferred: body.preferred ?? []
    };
}

async function findMeetup(id, res) {
    const meetups = await readMeetups();
    const meetup = meetups.find(m => m.meetupId === id);
    if (!meetup) {
        res.status(404).json({ error: "존재하지 않는 약속입니다." });
        return {};
    }
    return { meetups, meetup };
}

// POST /meetups : 약속 방 만들기
router.post("/", async (req, res, next) => {
    try {
        const { name, minMinutes = 60 } = req.body || {};

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({ error: "약속 이름을 입력해주세요." });
        }
        if (!Number.isInteger(minMinutes) || minMinutes < 15 || minMinutes > 480) {
            return res.status(400).json({ error: "최소 만남 시간은 15~480분 사이의 정수여야 합니다." });
        }

        const meetups = await readMeetups();
        let meetupId;
        do {
            meetupId = randomBytes(6).toString("hex");
        } while (meetups.some(m => m.meetupId === meetupId));

        const meetup = { meetupId, name: name.trim(), minMinutes, members: [] };
        meetups.push(meetup);
        await writeMeetups(meetups);

        res.status(201).json({ meetupId, meetup: publicMeetup(meetup) });
    } catch (error) {
        next(error);
    }
});

// GET /meetups/:id : 약속 방과 참여자 조회
router.get("/:id", async (req, res, next) => {
    try {
        const { meetup } = await findMeetup(req.params.id, res);
        if (!meetup) return;
        res.json(publicMeetup(meetup));
    } catch (error) {
        next(error);
    }
});

// POST /meetups/:id/members : 참여 (닉네임, 출발역, 선택 일정)
router.post("/:id/members", async (req, res, next) => {
    try {
        const errors = validateMember(req.body, stationIds);
        if (errors.length > 0) {
            return res.status(400).json({ message: "입력 오류", errors });
        }

        const { meetups, meetup } = await findMeetup(req.params.id, res);
        if (!meetup) return;

        const fields = memberFields(req.body);
        if (meetup.members.some(m => m.nickname === fields.nickname)) {
            return res.status(409).json({ error: "이미 사용 중인 닉네임입니다." });
        }

        const { token, hash } = issueEditToken();
        const member = { memberId: randomUUID(), ...fields, editTokenHash: hash };
        meetup.members.push(member);
        await writeMeetups(meetups);

        res.status(201).json({ memberId: member.memberId, editToken: token, member: publicMember(member) });
    } catch (error) {
        next(error);
    }
});

// PATCH /meetups/:id/members/:memberId : 내 정보 수정 (수정 토큰 필요)
router.patch("/:id/members/:memberId", async (req, res, next) => {
    try {
        const { meetups, meetup } = await findMeetup(req.params.id, res);
        if (!meetup) return;

        const member = meetup.members.find(m => m.memberId === req.params.memberId);
        if (!member) {
            return res.status(404).json({ error: "존재하지 않는 참여자입니다." });
        }
        if (!verifyEditToken(req.get("X-Edit-Token"), member.editTokenHash)) {
            return res.status(403).json({ error: "수정 권한이 없습니다." });
        }

        const errors = validateMember(req.body, stationIds);
        if (errors.length > 0) {
            return res.status(400).json({ message: "입력 오류", errors });
        }

        const fields = memberFields(req.body);
        if (meetup.members.some(m => m.memberId !== member.memberId && m.nickname === fields.nickname)) {
            return res.status(409).json({ error: "이미 사용 중인 닉네임입니다." });
        }

        Object.assign(member, fields);
        await writeMeetups(meetups);
        res.json({ member: publicMember(member) });
    } catch (error) {
        next(error);
    }
});

// DELETE /meetups/:id/members/:memberId : 참여 취소 (수정 토큰 필요)
router.delete("/:id/members/:memberId", async (req, res, next) => {
    try {
        const { meetups, meetup } = await findMeetup(req.params.id, res);
        if (!meetup) return;

        const index = meetup.members.findIndex(m => m.memberId === req.params.memberId);
        if (index === -1) {
            return res.status(404).json({ error: "존재하지 않는 참여자입니다." });
        }
        if (!verifyEditToken(req.get("X-Edit-Token"), meetup.members[index].editTokenHash)) {
            return res.status(403).json({ error: "삭제 권한이 없습니다." });
        }

        if (meetup.votes) delete meetup.votes[req.params.memberId];
        meetup.members.splice(index, 1);
        await writeMeetups(meetups);
        res.json({ memberId: req.params.memberId });
    } catch (error) {
        next(error);
    }
});

// GET /meetups/:id/places?tag=카페 : 모두 오기 좋은 핫플 역 순위
router.get("/:id/places", async (req, res, next) => {
    try {
        const { meetup } = await findMeetup(req.params.id, res);
        if (!meetup) return;

        const tag = typeof req.query.tag === "string" && req.query.tag ? req.query.tag : null;
        const origins = meetup.members
            .filter(m => stationById.has(m.stationId))
            .map(m => ({ nickname: m.nickname, station: stationById.get(m.stationId) }));

        // 상위 10곳에 더해, 투표를 받은 역은 순위가 낮아도 함께 보여 준다
        const tally = tallyVotes(meetup.votes, meetup.members);
        const votedIds = new Set(tally.map(t => t.stationId));
        const { center, results: ranked } = rankMeetingStations(origins, stations, { tag, timesFrom, limit: Infinity });
        const shown = ranked.filter((r, i) => i < 10 || votedIds.has(r.stationId));
        const voteOf = new Map(tally.map(t => [t.stationId, t]));

        res.json({
            memberCount: origins.length,
            tag,
            center,
            results: shown.map(r => ({ ...r, votes: voteOf.get(r.stationId)?.count ?? 0, voters: voteOf.get(r.stationId)?.voters ?? [] })),
            votes: {
                votedCount: tally.reduce((sum, t) => sum + t.count, 0),
                majority: majorityChoice(tally, meetup.members.length),
                tally: tally.map(t => ({ ...t, name: nameOf(t.stationId) }))
            }
        });
    } catch (error) {
        next(error);
    }
});

// PUT /meetups/:id/votes/:memberId : 장소 투표 (한 사람 한 표, 다시 하면 바뀐다. 수정 토큰 필요)
router.put("/:id/votes/:memberId", async (req, res, next) => {
    try {
        const { meetups, meetup } = await findMeetup(req.params.id, res);
        if (!meetup) return;

        const member = meetup.members.find(m => m.memberId === req.params.memberId);
        if (!member) {
            return res.status(404).json({ error: "존재하지 않는 참여자입니다." });
        }
        if (!verifyEditToken(req.get("X-Edit-Token"), member.editTokenHash)) {
            return res.status(403).json({ error: "투표 권한이 없습니다." });
        }
        const station = stationById.get(req.body?.stationId);
        if (!station || station.hot === 0) {
            return res.status(400).json({ error: "추천 목록에 있는 장소에만 투표할 수 있습니다." });
        }

        meetup.votes = { ...(meetup.votes ?? {}), [member.memberId]: station.id };
        await writeMeetups(meetups);
        res.json({ memberId: member.memberId, stationId: station.id });
    } catch (error) {
        next(error);
    }
});

// DELETE /meetups/:id/votes/:memberId : 투표 취소 (수정 토큰 필요)
router.delete("/:id/votes/:memberId", async (req, res, next) => {
    try {
        const { meetups, meetup } = await findMeetup(req.params.id, res);
        if (!meetup) return;

        const member = meetup.members.find(m => m.memberId === req.params.memberId);
        if (!member) {
            return res.status(404).json({ error: "존재하지 않는 참여자입니다." });
        }
        if (!verifyEditToken(req.get("X-Edit-Token"), member.editTokenHash)) {
            return res.status(403).json({ error: "투표 권한이 없습니다." });
        }

        if (meetup.votes) delete meetup.votes[member.memberId];
        await writeMeetups(meetups);
        res.json({ memberId: member.memberId, stationId: null });
    } catch (error) {
        next(error);
    }
});

// GET /meetups/:id/times : 일정을 넣은 사람들이 모두 비는 시간 순위
router.get("/:id/times", async (req, res, next) => {
    try {
        const { meetup } = await findMeetup(req.params.id, res);
        if (!meetup) return;

        res.json({
            memberCount: meetup.members.length,
            scheduledCount: meetup.members.filter(m => m.hasSchedule).length,
            times: findCommonFreeTimes(meetup.members, meetup.minMinutes)
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
