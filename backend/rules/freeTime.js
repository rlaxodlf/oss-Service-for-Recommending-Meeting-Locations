// 일반 모드: 일정을 넣은 사람들이 모두 비는 시간을 찾는다.
// 학생 모드(rules/slots.js)와 달리 주말을 포함하고 밤 11시까지 본다.

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_START = 9 * 60;
const DAY_END = 23 * 60;
const PERIODS = ["morning", "afternoon", "evening"];

function toMinutes(time) {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
}

function toTime(minutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// 시작 시각이 속한 시간대: 12시 전 오전, 18시 전 오후, 그 뒤 저녁
function periodOf(minutes) {
    if (minutes < 12 * 60) return "morning";
    if (minutes < 18 * 60) return "afternoon";
    return "evening";
}

// 한 사람의 하루 일정에서 비는 구간
function freeIntervals(busy, day) {
    const blocks = busy
        .filter(b => b.day === day)
        .map(b => ({ start: toMinutes(b.start), end: toMinutes(b.end) }))
        .sort((a, b) => a.start - b.start);

    const free = [];
    let current = DAY_START;
    for (const b of blocks) {
        const start = Math.max(DAY_START, b.start);
        const end = Math.min(DAY_END, b.end);
        if (end <= start) continue;
        if (current < start) free.push({ start: current, end: start });
        current = Math.max(current, end);
    }
    if (current < DAY_END) free.push({ start: current, end: DAY_END });
    return free;
}

function intersect(first, second) {
    const result = [];
    for (const a of first) {
        for (const b of second) {
            const start = Math.max(a.start, b.start);
            const end = Math.min(a.end, b.end);
            if (start < end) result.push({ start, end });
        }
    }
    return result;
}

// 각 시간대의 범위(분). 저녁은 계산 범위 끝까지
const PERIOD_RANGES = {
    morning: [DAY_START, 12 * 60],
    afternoon: [12 * 60, 18 * 60],
    evening: [18 * 60, DAY_END]
};

// 빈 시간이 그 시간대와 1시간 이상(짧은 시간이면 전체) 겹치면 그 시간대에 만날 수 있다고 본다
function coversPeriod(slot, period) {
    const [pStart, pEnd] = PERIOD_RANGES[period];
    const overlap = Math.min(toMinutes(slot.end), pEnd) - Math.max(toMinutes(slot.start), pStart);
    return overlap >= Math.min(60, slot.duration);
}

// 시간대 점수: 길이(최대 60점) + 선호하는 시간대에 만날 수 있는 사람 비율(최대 40점)
function scoreSlot(slot, members) {
    const lengthScore = Math.min(60, Math.floor(slot.duration / 10));
    const liked = members.filter(m => (m.preferred || []).some(p => coversPeriod(slot, p))).length;
    return lengthScore + Math.round((liked / members.length) * 40);
}

// 일정을 넣은 사람만 대상으로 공통으로 비는 시간을 점수 순으로 돌려준다
function findCommonFreeTimes(members, minMinutes) {
    const withSchedule = members.filter(m => m.hasSchedule);
    if (withSchedule.length === 0) return [];

    const slots = [];
    for (const day of DAYS) {
        let common = [{ start: DAY_START, end: DAY_END }];
        for (const m of withSchedule) {
            common = intersect(common, freeIntervals(m.busy || [], day));
        }
        for (const t of common) {
            const duration = t.end - t.start;
            if (duration < minMinutes) continue;
            const start = toTime(t.start);
            const end = toTime(t.end);
            slots.push({ slotId: `${day}-${start.replace(":", "")}-${end.replace(":", "")}`, day, start, end, duration });
        }
    }

    return slots
        .map(s => ({ ...s, score: scoreSlot(s, withSchedule) }))
        .sort((a, b) =>
            b.score - a.score ||
            DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
            a.start.localeCompare(b.start)
        );
}

module.exports = {
    DAYS,
    PERIODS,
    toMinutes,
    periodOf,
    coversPeriod,
    freeIntervals,
    findCommonFreeTimes
};
