const test = require("node:test");
const assert = require("node:assert/strict");
const { distanceKm, estimateMinutes, rankMeetingStations } = require("../rules/midpoint");

// 테스트용 가상 역. 경도 0.01도 차이 ≒ 0.88km (위도 37.5 기준)
const station = (id, lng, hot, tags = ["맛집"]) =>
    ({ id, name: id, lines: ["1"], lat: 37.5, lng, hot, tags, desc: "" });

const west = station("west", 126.90, 0);
const east = station("east", 127.00, 0);
const middle = station("middle", 126.95, 3);
const nearWest = station("nearWest", 126.91, 3);
const stations = [west, east, middle, nearWest];

test("같은 역 사이 이동 시간은 0분이다", () => {
    assert.equal(estimateMinutes(middle, middle), 0);
});

test("거리는 방향과 관계없이 같다", () => {
    assert.equal(distanceKm(west, east), distanceKm(east, west));
});

test("멀수록 이동 시간이 길다", () => {
    assert.ok(estimateMinutes(west, middle) < estimateMinutes(west, east));
});

test("서쪽과 동쪽에서 오면 한쪽에 치우친 역보다 가운데 역을 먼저 추천한다", () => {
    const origins = [{ nickname: "A", station: west }, { nickname: "B", station: east }];
    const { results } = rankMeetingStations(origins, stations);
    assert.equal(results[0].stationId, "middle");
});

test("핫플 점수가 0인 역은 추천하지 않는다", () => {
    const origins = [{ nickname: "A", station: west }, { nickname: "B", station: east }];
    const ids = rankMeetingStations(origins, stations).results.map(r => r.stationId);
    assert.ok(!ids.includes("west") && !ids.includes("east"));
});

test("이동 시간이 같으면 핫플 점수가 높은 역이 앞선다", () => {
    const quiet = station("quiet", 126.95, 1);
    const hot = station("hot", 126.95, 5);
    const origins = [{ nickname: "A", station: west }, { nickname: "B", station: east }];
    const { results } = rankMeetingStations(origins, [west, east, quiet, hot]);
    assert.deepEqual(results.map(r => r.stationId), ["hot", "quiet"]);
});

test("분위기 태그를 고르면 그 태그가 있는 역만 나온다", () => {
    const cafe = station("cafe", 126.96, 2, ["카페"]);
    const origins = [{ nickname: "A", station: west }];
    const { results } = rankMeetingStations(origins, [...stations, cafe], { tag: "카페" });
    assert.deepEqual(results.map(r => r.stationId), ["cafe"]);
});

test("참여자가 없으면 빈 결과를 돌려준다", () => {
    assert.deepEqual(rankMeetingStations([], stations), { center: null, results: [] });
});

test("노선 시간표를 주면 직선거리 대신 그 시간으로 순위를 매긴다", () => {
    // 직선으로는 middle이 가운데지만, 노선상으로는 nearWest가 두 사람 모두에게 15분이다
    const table = {
        west: new Map([["middle", { minutes: 40, transfers: 2 }], ["nearWest", { minutes: 15, transfers: 0 }]]),
        east: new Map([["middle", { minutes: 40, transfers: 2 }], ["nearWest", { minutes: 15, transfers: 0 }]])
    };
    const origins = [{ nickname: "A", station: west }, { nickname: "B", station: east }];
    const { results } = rankMeetingStations(origins, stations, { timesFrom: s => table[s.id] });
    assert.equal(results[0].stationId, "nearWest");
    assert.ok(results[0].reasons.includes("모두 환승 없이 와요"));
});

test("결과에는 사람마다 예상 이동 시간이 들어 있다", () => {
    const origins = [{ nickname: "A", station: west }, { nickname: "B", station: east }];
    const first = rankMeetingStations(origins, stations).results[0];
    assert.deepEqual(first.times.map(t => t.nickname), ["A", "B"]);
    assert.equal(first.maxMinutes, Math.max(...first.times.map(t => t.minutes)));
});
