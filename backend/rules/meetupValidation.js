// 일반 모드 참여자 입력 검사: 닉네임, 출발역, (선택) 일정, 선호 시간대

const { DAYS, PERIODS } = require("./freeTime");

function toMinutesOrNull(time) {
    if (typeof time !== "string") return null;
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

// stationIds: 존재하는 역 id 목록
function validateMember(data, stationIds) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return ["입력 데이터가 올바르지 않습니다."];
    }

    const errors = [];

    if (typeof data.nickname !== "string" || !data.nickname.trim() || data.nickname.trim().length > 30) {
        errors.push("닉네임은 1~30자로 입력해주세요.");
    }

    if (!stationIds.includes(data.stationId)) {
        errors.push("출발역을 목록에서 골라주세요.");
    }

    const busy = data.busy ?? [];
    if (!Array.isArray(busy)) {
        errors.push("일정은 배열이어야 합니다.");
    } else {
        busy.forEach((b, i) => {
            if (!b || typeof b !== "object" || !DAYS.includes(b.day)) {
                errors.push(`${i + 1}번째 일정의 요일이 올바르지 않습니다.`);
                return;
            }
            const start = toMinutesOrNull(b.start);
            const end = toMinutesOrNull(b.end);
            if (start === null || end === null || start >= end) {
                errors.push(`${i + 1}번째 일정의 시작·종료 시간이 올바르지 않습니다.`);
            }
        });

        for (let i = 0; i < busy.length; i++) {
            for (let j = i + 1; j < busy.length; j++) {
                const a = busy[i];
                const b = busy[j];
                if (!a || !b || a.day !== b.day) continue;
                const [as, ae, bs, be] = [a.start, a.end, b.start, b.end].map(toMinutesOrNull);
                if ([as, ae, bs, be].includes(null)) continue;
                if (as < be && bs < ae) errors.push(`${i + 1}번째와 ${j + 1}번째 일정이 겹칩니다.`);
            }
        }
    }

    const preferred = data.preferred ?? [];
    if (!Array.isArray(preferred) || preferred.some(p => !PERIODS.includes(p))) {
        errors.push("선호 시간대는 morning, afternoon, evening만 가능합니다.");
    }

    return errors;
}

module.exports = { validateMember };
