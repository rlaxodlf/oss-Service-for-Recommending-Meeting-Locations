const test = require("node:test");
const assert = require("node:assert/strict");
const { validateSchedule } = require("../rules/validation");
const { calculateSlots } = require("../rules/slots");
const { rankSlots } = require("../rules/scoring");

const cls = (day, start, end, building = "새빛관") => ({ day, start, end, building });

test("토·일 수업도 올바른 시간표로 받는다", () => {
    const errors = validateSchedule({ nickname: "민수", classes: [cls("sat", "10:00", "12:00"), cls("sun", "13:00", "15:00")] });
    assert.deepEqual(errors, []);
});

test("한글 요일 '토', '일'도 받는다", () => {
    assert.deepEqual(validateSchedule({ nickname: "민수", classes: [cls("토", "10:00", "12:00"), cls("일", "13:00", "15:00")] }), []);
});

test("없는 요일은 오류다", () => {
    assert.deepEqual(validateSchedule({ nickname: "민수", classes: [cls("xyz", "10:00", "12:00")] }), ["1번째 수업의 요일이 올바르지 않습니다."]);
});

test("같은 날 겹치는 수업은 오류다", () => {
    const errors = validateSchedule({ nickname: "민수", classes: [cls("sat", "10:00", "12:00"), cls("sat", "11:00", "13:00")] });
    assert.deepEqual(errors, ["1번째와 2번째 수업 시간이 겹칩니다."]);
});

test("공통 공강 계산에 주말도 들어간다", () => {
    const room = { minMinutes: 60, members: [{ classes: [cls("sat", "09:00", "12:00")] }] };
    const sat = calculateSlots(room).filter(s => s.day === "sat");
    assert.deepEqual(sat.map(s => [s.start, s.end]), [["12:00", "18:00"]]);
});

test("일요일 수업이 하루 종일이면 일요일 공강은 없다", () => {
    const room = { minMinutes: 60, members: [{ classes: [cls("sun", "09:00", "18:00")] }] };
    assert.ok(!calculateSlots(room).some(s => s.day === "sun"));
});

test("두 사람 모두 비는 시간만 남는다", () => {
    const room = {
        minMinutes: 60,
        members: [
            { classes: [cls("mon", "10:00", "12:00")] },
            { classes: [cls("mon", "13:00", "15:00")] }
        ]
    };
    const mon = calculateSlots(room).filter(s => s.day === "mon");
    assert.deepEqual(mon.map(s => [s.start, s.end]), [["09:00", "10:00"], ["12:00", "13:00"], ["15:00", "18:00"]]);
});

test("점수가 같으면 요일 순서(월→일)로 정렬한다", () => {
    const slot = day => ({ slotId: day, day, start: "09:00", end: "10:00", duration: 60 });
    const ranked = rankSlots([slot("sun"), slot("fri"), slot("mon")], []);
    assert.deepEqual(ranked.map(s => s.day), ["mon", "fri", "sun"]);
});
