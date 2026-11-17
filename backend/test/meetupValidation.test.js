const test = require("node:test");
const assert = require("node:assert/strict");
const { validateMember } = require("../rules/meetupValidation");

const ids = ["gangnam", "hongik"];
const valid = { nickname: "민수", stationId: "gangnam" };

test("닉네임과 출발역만 있어도 통과한다", () => {
    assert.deepEqual(validateMember(valid, ids), []);
});

test("목록에 없는 출발역은 오류다", () => {
    assert.deepEqual(validateMember({ ...valid, stationId: "nowhere" }, ids), ["출발역을 목록에서 골라주세요."]);
});

test("빈 닉네임은 오류다", () => {
    assert.equal(validateMember({ ...valid, nickname: "  " }, ids).length, 1);
});

test("주말 일정도 받는다", () => {
    const busy = [{ day: "sun", start: "10:00", end: "12:00" }];
    assert.deepEqual(validateMember({ ...valid, busy }, ids), []);
});

test("끝이 시작보다 이른 일정은 오류다", () => {
    const busy = [{ day: "mon", start: "15:00", end: "13:00" }];
    assert.deepEqual(validateMember({ ...valid, busy }, ids), ["1번째 일정의 시작·종료 시간이 올바르지 않습니다."]);
});

test("같은 날 겹치는 일정은 오류다", () => {
    const busy = [
        { day: "sat", start: "10:00", end: "12:00" },
        { day: "sat", start: "11:00", end: "13:00" }
    ];
    assert.deepEqual(validateMember({ ...valid, busy }, ids), ["1번째와 2번째 일정이 겹칩니다."]);
});

test("정해진 값이 아닌 선호 시간대는 오류다", () => {
    assert.equal(validateMember({ ...valid, preferred: ["night"] }, ids).length, 1);
});
