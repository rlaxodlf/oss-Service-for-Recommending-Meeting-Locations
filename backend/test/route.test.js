const test = require("node:test");
const assert = require("node:assert/strict");
const { buildNetwork, shortestTimes, searchFrom, routeLegs, BOARD_MINUTES, TRANSFER_MINUTES } = require("../rules/route");

// 1호선: A - B - C, 2호선: C - D, 3호선(느린 우회로): A - D
const edges = [
    { a: "A", b: "B", line: "1", minutes: 2 },
    { a: "B", b: "C", line: "1", minutes: 3 },
    { a: "C", b: "D", line: "2", minutes: 2 },
    { a: "A", b: "D", line: "3", minutes: 30 }
];
const network = buildNetwork(edges);

test("출발역 자신은 0분이다", () => {
    assert.deepEqual(shortestTimes(network, "A").get("A"), { minutes: 0, transfers: 0 });
});

test("같은 노선은 구간 시간을 더하고 탑승 시간을 한 번 더한다", () => {
    assert.deepEqual(shortestTimes(network, "A").get("C"), { minutes: BOARD_MINUTES + 5, transfers: 0 });
});

test("노선을 갈아타면 환승 시간과 환승 횟수가 붙는다", () => {
    const toD = shortestTimes(network, "A").get("D");
    assert.deepEqual(toD, { minutes: BOARD_MINUTES + 5 + TRANSFER_MINUTES + 2, transfers: 1 });
});

test("환승하더라도 더 빠른 길을 고른다", () => {
    // 3호선으로 바로 가면 30분, 1호선→2호선 환승이 더 빠르다
    assert.ok(shortestTimes(network, "A").get("D").minutes < BOARD_MINUTES + 30);
});

test("방향을 바꿔도 시간이 같다", () => {
    assert.equal(shortestTimes(network, "A").get("D").minutes, shortestTimes(network, "D").get("A").minutes);
});

test("몇 분 차이라면 환승 없는 길을 고른다", () => {
    // E에서 F로: 4호선 한 번에 13분, 또는 5호선 3분 + 환승 4분 + 6호선 4분 = 11분
    const close = buildNetwork([
        { a: "E", b: "F", line: "4", minutes: 13 },
        { a: "E", b: "G", line: "5", minutes: 3 },
        { a: "G", b: "F", line: "6", minutes: 4 }
    ]);
    assert.deepEqual(shortestTimes(close, "E").get("F"), { minutes: BOARD_MINUTES + 13, transfers: 0 });
});

test("환승해서 훨씬 빠르면 환승하는 길을 고른다", () => {
    const far = buildNetwork([
        { a: "E", b: "F", line: "4", minutes: 30 },
        { a: "E", b: "G", line: "5", minutes: 3 },
        { a: "G", b: "F", line: "6", minutes: 4 }
    ]);
    assert.equal(shortestTimes(far, "E").get("F").transfers, 1);
});

test("연결되지 않은 역은 결과에 없다", () => {
    const apart = buildNetwork([...edges, { a: "X", b: "Y", line: "9", minutes: 2 }]);
    assert.equal(shortestTimes(apart, "A").has("X"), false);
});

test("길 안내: 갈아타는 곳에서 구간이 나뉜다", () => {
    const legs = routeLegs(searchFrom(network, "A"), "D");
    assert.deepEqual(legs, [
        { line: "1", from: "A", to: "C", stops: 2, minutes: 5 },
        { line: "2", from: "C", to: "D", stops: 1, minutes: 2 }
    ]);
});

test("길 안내: 출발역 자신이면 빈 목록, 갈 수 없으면 null", () => {
    const apart = buildNetwork([...edges, { a: "X", b: "Y", line: "9", minutes: 2 }]);
    const search = searchFrom(apart, "A");
    assert.deepEqual(routeLegs(search, "A"), []);
    assert.equal(routeLegs(search, "X"), null);
});
