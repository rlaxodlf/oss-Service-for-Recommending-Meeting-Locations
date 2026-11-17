// 일반 모드: 역 사이 구간(노선별 소요 시간)으로 출발역에서 모든 역까지의 최단 시간을 구한다.
// 같은 역이라도 노선마다 따로 두고, 노선을 갈아타면 환승 시간을 더한다.

const BOARD_MINUTES = 5;    // 역까지 걷고 열차를 기다리는 시간(분)
const TRANSFER_MINUTES = 4; // 같은 역에서 다른 노선으로 갈아타는 시간(분)
const TRANSFER_AVOID = 3;   // 길을 고를 때만 환승 1번에 더하는 불편 벌점(분). 보여 주는 시간에는 넣지 않는다

const nodeKey = (stationId, line) => `${stationId}|${line}`;

// edges: [{ a, b, line, minutes }] → 노선별 역을 점으로 하는 그래프
function buildNetwork(edges) {
    const adjacent = new Map();
    const linesAt = new Map();

    const addLink = (from, to, minutes, transfer) => {
        if (!adjacent.has(from)) adjacent.set(from, []);
        adjacent.get(from).push({ to, minutes, transfer });
    };

    for (const e of edges) {
        addLink(nodeKey(e.a, e.line), nodeKey(e.b, e.line), e.minutes, false);
        addLink(nodeKey(e.b, e.line), nodeKey(e.a, e.line), e.minutes, false);
        for (const id of [e.a, e.b]) {
            if (!linesAt.has(id)) linesAt.set(id, new Set());
            linesAt.get(id).add(e.line);
        }
    }

    // 여러 노선이 서는 역은 노선끼리 환승으로 잇는다
    for (const [id, lines] of linesAt) {
        for (const l1 of lines) {
            for (const l2 of lines) {
                if (l1 !== l2) addLink(nodeKey(id, l1), nodeKey(id, l2), TRANSFER_MINUTES, true);
            }
        }
    }

    return { adjacent, linesAt };
}

// 사람이 느끼는 부담 = 걸린 시간 + 환승 벌점. 몇 분 차이라면 환승 없는 길을 고르게 된다
const burden = t => t.minutes + t.transfers * TRANSFER_AVOID;

// 부담이 작은 것부터, 같으면 환승이 적은 것부터 꺼내는 우선순위 큐
class MinQueue {
    constructor() { this.items = []; }
    get size() { return this.items.length; }
    static less(a, b) { return burden(a) - burden(b) || a.transfers - b.transfers; }
    push(item) {
        const items = this.items;
        items.push(item);
        let i = items.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (MinQueue.less(items[parent], items[i]) <= 0) break;
            [items[parent], items[i]] = [items[i], items[parent]];
            i = parent;
        }
    }
    pop() {
        const items = this.items;
        const top = items[0];
        const last = items.pop();
        if (items.length > 0) {
            items[0] = last;
            let i = 0;
            for (;;) {
                const l = 2 * i + 1;
                const r = l + 1;
                let m = i;
                if (l < items.length && MinQueue.less(items[l], items[m]) < 0) m = l;
                if (r < items.length && MinQueue.less(items[r], items[m]) < 0) m = r;
                if (m === i) break;
                [items[m], items[i]] = [items[i], items[m]];
                i = m;
            }
        }
        return top;
    }
}

// 출발역에서 모든 역까지 가장 부담이 적은 길을 찾는다.
// (다익스트라 알고리즘: 가장 빨리 닿는 곳부터 차례로 확정한다)
// 돌려주는 값: { fromId, visited: 노선별 역 → 도착 상태, arrival: 역 → 가장 좋은 도착 상태 }
// 도착 상태에는 바로 앞 지점(prev)이 들어 있어 길을 거꾸로 따라갈 수 있다
function searchFrom(network, fromId) {
    const visited = new Map();
    const arrival = new Map();
    const queue = new MinQueue();

    for (const line of network.linesAt.get(fromId) || []) {
        queue.push({ key: nodeKey(fromId, line), minutes: BOARD_MINUTES, transfers: 0, prev: null });
    }

    while (queue.size > 0) {
        const cur = queue.pop();
        if (visited.has(cur.key)) continue;
        visited.set(cur.key, cur);

        const stationId = cur.key.slice(0, cur.key.lastIndexOf("|"));
        const known = arrival.get(stationId);
        if (!known || MinQueue.less(cur, known) < 0) arrival.set(stationId, cur);

        for (const link of network.adjacent.get(cur.key) || []) {
            if (visited.has(link.to)) continue;
            queue.push({
                key: link.to,
                minutes: cur.minutes + link.minutes,
                transfers: cur.transfers + (link.transfer ? 1 : 0),
                prev: cur.key
            });
        }
    }

    return { fromId, visited, arrival };
}

// 출발역에서 각 역까지 { minutes, transfers }. 출발역 자신은 0분
function shortestTimes(network, fromId, search = searchFrom(network, fromId)) {
    const result = new Map([[fromId, { minutes: 0, transfers: 0 }]]);
    for (const [id, state] of search.arrival) {
        // 소수점 구간 시간을 더했으므로 분 단위로 반올림한다
        if (id !== fromId) result.set(id, { minutes: Math.round(state.minutes), transfers: state.transfers });
    }
    return result;
}

// 찾은 길을 "탄 노선별 구간"으로 정리한다.
// [{ line, from, to, stops, minutes }] — from/to는 역 id, stops는 지나는 역 수, minutes는 그 노선에서 탄 시간
// 출발역 자신이면 [], 갈 수 없으면 null
function routeLegs(search, toId) {
    if (toId === search.fromId) return [];
    const end = search.arrival.get(toId);
    if (!end) return null;

    const states = [];
    for (let key = end.key; key; key = search.visited.get(key).prev) {
        states.push(search.visited.get(key));
    }
    states.reverse();

    const split = key => {
        const i = key.lastIndexOf("|");
        return { station: key.slice(0, i), line: key.slice(i + 1) };
    };

    const legs = [];
    let leg = null;
    for (const state of states) {
        const { station, line } = split(state.key);
        if (leg && leg.line === line) {
            leg.to = station;
            leg.stops += 1;
            leg.endMinutes = state.minutes;
        } else {
            // 노선이 바뀌면(환승) 새 구간을 시작한다
            leg = { line, from: station, to: station, stops: 0, startMinutes: state.minutes, endMinutes: state.minutes };
            legs.push(leg);
        }
    }

    return legs
        .filter(l => l.stops > 0)
        .map(l => ({ line: l.line, from: l.from, to: l.to, stops: l.stops, minutes: Math.round(l.endMinutes - l.startMinutes) }));
}

module.exports = {
    BOARD_MINUTES,
    TRANSFER_MINUTES,
    TRANSFER_AVOID,
    buildNetwork,
    searchFrom,
    shortestTimes,
    routeLegs
};
