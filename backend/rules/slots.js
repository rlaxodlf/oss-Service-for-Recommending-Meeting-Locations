
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// 회의 가능한 시간: 오전 9시 ~ 오후 6시
const DAY_START = 9 * 60;
const DAY_END = 18 * 60;

// "10:30" -> 630분
function toMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

// 630분 -> "10:30"
function toTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// 수업 시간을 제외하고 비어 있는 구간 계산
function getFreeTimes(classes, day) {
  const todayClasses = classes
    .filter((item) => item.day === day)
    .map((item) => ({
      start: toMinutes(item.start),
      end: toMinutes(item.end)
    }))
    .sort((a, b) => a.start - b.start);

  const freeTimes = [];
  let current = DAY_START;

  for (const item of todayClasses) {
    const start = Math.max(DAY_START, item.start);
    const end = Math.min(DAY_END, item.end);

    if (end <= start) continue;

    if (current < start) {
      freeTimes.push({ start: current, end: start });
    }

    current = Math.max(current, end);
  }

  if (current < DAY_END) {
    freeTimes.push({ start: current, end: DAY_END });
  }

  return freeTimes;
}

// 두 공강 목록의 교집합
function intersectTimes(first, second) {
  const result = [];

  for (const a of first) {
    for (const b of second) {
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);

      if (start < end) {
        result.push({ start, end });
      }
    }
  }

  return result;
}

// 모든 팀원이 공통으로 비는 시간 계산
function calculateSlots(room) {
  const members = room.members || [];
  const minMinutes = room.minMinutes || 60;

  if (members.length === 0) {
    return [];
  }

  const slots = [];

  for (const day of DAYS) {
    let commonFree = [
      { start: DAY_START, end: DAY_END }
    ];

    for (const member of members) {
      const memberFree = getFreeTimes(
        member.classes || [],
        day
      );

      commonFree = intersectTimes(commonFree, memberFree);
    }

    for (const time of commonFree) {
      const duration = time.end - time.start;

      if (duration < minMinutes) continue;

      const start = toTime(time.start);
      const end = toTime(time.end);

      slots.push({
        slotId: `${day}-${start.replace(":", "")}-${end.replace(":", "")}`,
        day,
        start,
        end,
        duration
      });
    }
  }

  return slots;
}

module.exports = {
  calculateSlots
};
