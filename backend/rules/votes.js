// 일반 모드: 장소 투표 집계. 한 사람당 한 표이며, 약속에서 빠진 사람의 표는 세지 않는다.

// votes: { memberId: stationId }, members: [{ memberId, nickname }]
// → [{ stationId, count, voters: [닉네임] }] 표가 많은 순, 같으면 먼저 표를 받은 순서
function tallyVotes(votes = {}, members = []) {
    const nicknameOf = new Map(members.map(m => [m.memberId, m.nickname]));
    const tally = new Map();

    for (const [memberId, stationId] of Object.entries(votes)) {
        if (!nicknameOf.has(memberId)) continue;
        if (!tally.has(stationId)) tally.set(stationId, { stationId, count: 0, voters: [] });
        const entry = tally.get(stationId);
        entry.count += 1;
        entry.voters.push(nicknameOf.get(memberId));
    }

    // Map은 넣은 순서를 지키므로, 정렬이 안정적이면 동점은 먼저 표를 받은 장소가 앞선다
    return [...tally.values()].sort((a, b) => b.count - a.count);
}

// 과반(참여자 절반 초과)의 표를 받은 장소가 있으면 그 장소, 없으면 null
function majorityChoice(tally, memberCount) {
    const top = tally[0];
    return top && top.count > memberCount / 2 ? top.stationId : null;
}

module.exports = { tallyVotes, majorityChoice };
