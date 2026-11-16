
const DAYS = ["mon", "tue", "wed", "thu", "fri"];
const PREFERENCES = ["morning", "afternoon", "evening"];

// HH:MM 형식인지 확인하고 분 단위로 변환
function toMinutes(time) {
    if (typeof time !== "string") return null;

    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (!match) return null;

    return Number(match[1]) * 60 + Number(match[2]);
}

// 시간표 검증
function validateSchedule(data) {
    const errors = [];

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return ["시간표 데이터가 올바르지 않습니다."];
    }

    if (
        typeof data.nickname !== "string" ||
        !data.nickname.trim() ||
        data.nickname.trim().length > 30
    ) {
        errors.push("닉네임은 1~30자로 입력해주세요.");
    }

    if (!Array.isArray(data.classes)) {
        errors.push("classes는 배열이어야 합니다.");
        return errors;
    }

    for (let i = 0; i < data.classes.length; i++) {
        const cls = data.classes[i];

        if (!cls || typeof cls !== "object" || Array.isArray(cls)) {
            errors.push(`${i + 1}번째 수업 정보가 올바르지 않습니다.`);
            continue;
        }

        if (!DAYS.includes(cls.day)) {
            errors.push(`${i + 1}번째 수업의 요일이 올바르지 않습니다.`);
        }

        const start = toMinutes(cls.start);
        const end = toMinutes(cls.end);

        if (start === null || end === null || start >= end) {
            errors.push(`${i + 1}번째 수업의 시작·종료 시간이 올바르지 않습니다.`);
        }

        if (
            typeof cls.building !== "string" ||
            !cls.building.trim()
        ) {
            errors.push(`${i + 1}번째 수업의 건물을 입력해주세요.`);
        }
    }

    // 같은 요일에 수업 시간이 겹치는지 확인
    for (let i = 0; i < data.classes.length; i++) {
        for (let j = i + 1; j < data.classes.length; j++) {
            const a = data.classes[i];
            const b = data.classes[j];

            if (!a || !b || a.day !== b.day) continue;
            if (!DAYS.includes(a.day)) continue;

            const aStart = toMinutes(a.start);
            const aEnd = toMinutes(a.end);
            const bStart = toMinutes(b.start);
            const bEnd = toMinutes(b.end);

            if ([aStart, aEnd, bStart, bEnd].some(v => v === null)) {
                continue;
            }

            if (aStart < bEnd && bStart < aEnd) {
                errors.push(`${i + 1}번째와 ${j + 1}번째 수업 시간이 겹칩니다.`);
            }
        }
    }

    if (
        data.preferred !== undefined &&
        (
            !Array.isArray(data.preferred) ||
            data.preferred.some(p => !PREFERENCES.includes(p))
        )
    ) {
        errors.push("선호 시간대는 morning, afternoon, evening만 가능합니다.");
    }

    return errors;
}

module.exports = { validateSchedule, toMinutes };
