// 일반 모드: 여러 사람의 출발역에서 모두 오기 좋은 핫플 역을 고른다.
// 이동 시간은 노선을 따라 계산한 최단 시간(rules/route.js)을 쓰고, 없으면 직선거리로 추정한다.

const MIN_PER_KM = 2;      // 지하철 1km당 걸리는 시간(분). 정차 시간을 포함한 대략값
const BASE_MINUTES = 8;    // 역까지 걷기, 기다리기, 갈아타기에 드는 기본 시간(분)
const SPREAD_WEIGHT = 0.5; // 사람 사이 이동 시간 차이에 주는 벌점 비율
const HOT_BONUS = 3;       // 핫플 점수 1점당 줄여 주는 비용(분)

// 두 좌표 사이 거리(km). 지구를 구로 보는 하버사인 공식
function distanceKm(a, b) {
    const R = 6371;
    const rad = deg => (deg * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

// 출발역에서 도착역까지 예상 이동 시간(분). 같은 역이면 0분
function estimateMinutes(from, to) {
    if (from.id === to.id) return 0;
    return Math.round(BASE_MINUTES + distanceKm(from, to) * MIN_PER_KM);
}

// 모두의 출발역 좌표 평균 (지도상 가운데 지점)
function centerOf(stations) {
    const lat = stations.reduce((sum, s) => sum + s.lat, 0) / stations.length;
    const lng = stations.reduce((sum, s) => sum + s.lng, 0) / stations.length;
    return { lat, lng };
}

// 기준 좌표에서 가장 가까운 역
function nearestStation(point, stations) {
    let best = null;
    let bestKm = Infinity;
    for (const s of stations) {
        const km = distanceKm(point, s);
        if (km < bestKm || (km === bestKm && s.name < best.name)) {
            best = s;
            bestKm = km;
        }
    }
    return best;
}

// 후보 역 하나를 평가한다.
// 가장 먼 사람의 시간이 짧을수록, 사람 사이 차이가 작을수록, 핫플 점수가 높을수록 비용이 낮다
// travel(i, station): i번째 사람이 그 역까지 가는 { minutes, transfers }
function evaluateStation(station, origins, travel) {
    const times = origins.map((o, i) => {
        const t = travel(i, station);
        return { nickname: o.nickname, from: o.station.name, minutes: t.minutes, transfers: t.transfers, legs: t.legs ?? null };
    });
    const minutes = times.map(t => t.minutes);
    const max = Math.max(...minutes);
    const min = Math.min(...minutes);
    const avg = Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length);
    const spread = max - min;
    const cost = max + spread * SPREAD_WEIGHT - station.hot * HOT_BONUS;

    return { station, times, max, avg, spread, cost };
}

// 추천 이유 문장
function reasonsFor(result, origins) {
    const reasons = [];
    if (origins.length > 1) {
        reasons.push(`가장 먼 사람도 ${result.max}분`);
        reasons.push(result.spread <= 10 ? `이동 시간 차이 ${result.spread}분으로 공평해요` : `이동 시간 차이 ${result.spread}분`);
    } else {
        reasons.push(`${result.max}분 거리`);
    }
    const transfers = result.times.map(t => t.transfers).filter(t => t !== null);
    if (transfers.length === result.times.length) {
        const most = Math.max(...transfers);
        reasons.push(most === 0 ? "모두 환승 없이 와요" : `환승은 많아야 ${most}번`);
    }
    if (result.station.hot >= 5) reasons.push("요즘 가장 핫한 곳");
    else if (result.station.hot >= 4) reasons.push("놀 거리가 많은 곳");
    return reasons;
}

// 출발역 목록 → 추천 역 순위
// origins: [{ nickname, station }], stations: 전체 역 목록, options.tag: 원하는 분위기(맛집, 카페 등)
// options.timesFrom(station): 그 역에서 각 역까지 Map(역 id → { minutes, transfers }) (rules/route.js)
//   주지 않거나 길이 없는 역은 직선거리로 추정한다
function rankMeetingStations(origins, stations, options = {}) {
    const { tag = null, limit = 10, timesFrom = null } = options;

    if (origins.length === 0) {
        return { center: null, results: [] };
    }

    const tables = origins.map(o => (timesFrom ? timesFrom(o.station) : null));
    const travel = (i, station) =>
        tables[i]?.get(station.id) ??
        { minutes: estimateMinutes(origins[i].station, station), transfers: null };

    const candidates = stations.filter(s =>
        s.hot > 0 && (!tag || s.tags.includes(tag))
    );

    const results = candidates
        .map(s => evaluateStation(s, origins, travel))
        .sort((a, b) =>
            a.cost - b.cost ||
            a.max - b.max ||
            b.station.hot - a.station.hot ||
            a.station.name.localeCompare(b.station.name)
        )
        .slice(0, limit)
        .map((r, i) => ({
            rank: i + 1,
            stationId: r.station.id,
            name: r.station.name,
            lines: r.station.lines,
            tags: r.station.tags,
            desc: r.station.desc,
            hot: r.station.hot,
            maxMinutes: r.max,
            avgMinutes: r.avg,
            spreadMinutes: r.spread,
            times: r.times,
            reasons: reasonsFor(r, origins)
        }));

    const centerStation = nearestStation(centerOf(origins.map(o => o.station)), stations);

    return {
        center: { stationId: centerStation.id, name: centerStation.name },
        results
    };
}

module.exports = {
    distanceKm,
    estimateMinutes,
    centerOf,
    nearestStation,
    rankMeetingStations
};
