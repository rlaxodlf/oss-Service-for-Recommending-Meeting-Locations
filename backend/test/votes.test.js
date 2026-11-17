const test = require("node:test");
const assert = require("node:assert/strict");
const { tallyVotes, majorityChoice } = require("../rules/votes");

const members = [
    { memberId: "m1", nickname: "민지" },
    { memberId: "m2", nickname: "서준" },
    { memberId: "m3", nickname: "하은" }
];

test("장소별로 표와 투표한 사람을 센다", () => {
    const tally = tallyVotes({ m1: "jongno3ga", m2: "jongno3ga", m3: "myeongdong" }, members);
    assert.deepEqual(tally, [
        { stationId: "jongno3ga", count: 2, voters: ["민지", "서준"] },
        { stationId: "myeongdong", count: 1, voters: ["하은"] }
    ]);
});

test("약속에서 빠진 사람의 표는 세지 않는다", () => {
    const tally = tallyVotes({ m1: "anguk", gone: "anguk" }, members);
    assert.equal(tally[0].count, 1);
});

test("표가 같으면 먼저 표를 받은 장소가 앞선다", () => {
    const tally = tallyVotes({ m1: "anguk", m2: "myeongdong" }, members);
    assert.deepEqual(tally.map(t => t.stationId), ["anguk", "myeongdong"]);
});

test("투표가 없으면 빈 목록이다", () => {
    assert.deepEqual(tallyVotes({}, members), []);
});

test("절반을 넘게 받으면 과반 장소로 정해진다", () => {
    const tally = tallyVotes({ m1: "anguk", m2: "anguk" }, members);
    assert.equal(majorityChoice(tally, 3), "anguk");
});

test("절반 이하면 과반 장소가 없다", () => {
    const tally = tallyVotes({ m1: "anguk", m2: "myeongdong" }, members.slice(0, 2).concat([{ memberId: "m4", nickname: "x" }]));
    assert.equal(majorityChoice(tally, 4), null);
});
