// 점수가 같을 때 정렬할 요일 순서 (알파벳순이면 fri가 mon보다 앞선다)
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// 시간을 분 단위로 변환
function toMinutes(time) {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
}

// 시간대를 구분
function getTimePeriod(time) {
    const minutes = toMinutes(time);

    if (minutes < 12 * 60) {
        return "morning";
    }

    if (minutes < 18 * 60) {
        return "afternoon";
    }

    return "evening";
}

// 공강 시간대 점수 계산
function calculateScore(slot, members = []) {
    let score = 0;

    // 1. 공강 길이 점수 (최대 60점)
    const duration = slot.duration;
    score += Math.min(60, Math.floor(duration / 10));

    // 2. 선호 시간대 점수 (최대 30점)
    const period = getTimePeriod(slot.start);

    if (members.length > 0) {
        const preferredCount = members.filter(member =>
            Array.isArray(member.preferred) &&
            member.preferred.includes(period)
        ).length;

        score += Math.round(
            (preferredCount / members.length) * 30
        );
    }

    // 3. 12시~18시 시작 시간대 가산점 (10점)
    const startMinutes = toMinutes(slot.start);

    if (
        startMinutes >= 12 * 60 &&
        startMinutes < 18 * 60
    ) {
        score += 10;
    }

    return Math.min(100, score);
}

// 공강 시간대에 점수 부여 후 정렬
function rankSlots(slots, members = []) {
    return slots
        .map(slot => ({
            ...slot,
            score: calculateScore(slot, members),
            reasons: getReasons(slot, members)
        }))
        .sort((a, b) =>
            b.score - a.score ||
            DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) ||
            a.start.localeCompare(b.start)
        );
}

function getReasons(slot, members = []) {
    const reasons = [];

    if (slot.duration >= 180) {
        reasons.push("3시간 이상 여유 있는 공강입니다.");
    } else if (slot.duration >= 60) {
        reasons.push("최소 모임 시간을 충족합니다.");
    }

    const period = getTimePeriod(slot.start);

    const preferredCount = members.filter(member =>
        Array.isArray(member.preferred) &&
        member.preferred.includes(period)
    ).length;

    if (preferredCount > 0) {
        reasons.push(
            `${members.length}명 중 ${preferredCount}명이 선호하는 시간대입니다.`
        );
    }

    if (period === "afternoon") {
        reasons.push("오후에 시작하는 모임입니다.");
    }

    return reasons;
}

module.exports = {
    calculateScore,
    rankSlots
};