const test = require("node:test");
const assert = require("node:assert/strict");
const { freeIntervals, findCommonFreeTimes, periodOf, toMinutes, coversPeriod } = require("../rules/freeTime");

const member = (busy, preferred = []) => ({ hasSchedule: true, busy, preferred });

test("일정이 없는 날은 09:00~23:00 전체가 빈다", () => {
    assert.deepEqual(freeIntervals([], "sat"), [{ start: 540, end: 1380 }]);
});

test("일정 앞뒤로 빈 구간이 나뉜다", () => {
    const busy = [{ day: "mon", start: "12:00", end: "14:00" }];
    assert.deepEqual(freeIntervals(busy, "mon"), [
        { start: 540, end: 720 },
        { start: 840, end: 1380 }
    ]);
});

test("두 사람 모두 비는 시간만 나온다", () => {
    const a = member([{ day: "sat", start: "09:00", end: "15:00" }]);
    const b = member([{ day: "sat", start: "18:00", end: "23:00" }]);
    const sat = findCommonFreeTimes([a, b], 60).filter(t => t.day === "sat");
    assert.deepEqual(sat.map(t => [t.start, t.end]), [["15:00", "18:00"]]);
});

test("최소 시간보다 짧은 공통 시간은 빠진다", () => {
    const a = member([{ day: "sun", start: "09:00", end: "22:30" }]);
    const times = findCommonFreeTimes([a], 60);
    assert.ok(!times.some(t => t.day === "sun"));
});

test("일정을 넣지 않은 사람은 계산에서 빠진다", () => {
    const a = member([{ day: "fri", start: "09:00", end: "23:00" }]);
    const noSchedule = { hasSchedule: false, busy: [], preferred: [] };
    const withOther = findCommonFreeTimes([a, noSchedule], 60);
    const alone = findCommonFreeTimes([a], 60);
    assert.deepEqual(withOther, alone);
});

test("아무도 일정을 넣지 않으면 빈 목록이다", () => {
    assert.deepEqual(findCommonFreeTimes([{ hasSchedule: false, busy: [] }], 60), []);
});

test("모두 저녁을 선호하면 같은 길이라도 저녁 시간이 먼저 나온다", () => {
    // 토요일은 오전 3시간, 저녁 3시간만 빈다
    const busy = [{ day: "sat", start: "12:00", end: "20:00" }];
    const others = ["mon", "tue", "wed", "thu", "fri", "sun"].map(day => ({ day, start: "09:00", end: "23:00" }));
    const times = findCommonFreeTimes([member([...busy, ...others], ["evening"])], 60);
    assert.deepEqual(times.map(t => t.start), ["20:00", "09:00"]);
});

test("오전에 시작해도 저녁까지 이어지는 빈 시간은 저녁 선호에 맞는다", () => {
    const allDay = { start: "09:00", end: "23:00", duration: 840 };
    const morningOnly = { start: "09:00", end: "11:00", duration: 120 };
    assert.equal(coversPeriod(allDay, "evening"), true);
    assert.equal(coversPeriod(morningOnly, "evening"), false);
});

test("시작 시각으로 오전·오후·저녁을 나눈다", () => {
    assert.equal(periodOf(toMinutes("11:59")), "morning");
    assert.equal(periodOf(toMinutes("12:00")), "afternoon");
    assert.equal(periodOf(toMinutes("18:00")), "evening");
});
