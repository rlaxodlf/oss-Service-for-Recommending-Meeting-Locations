// 서버와 주고받는 코드를 한곳에 모아둔 파일
// 백엔드가 바뀌면 이 파일만 고치면 돼요.

const API = "http://localhost:3000";

// true: 서버 API가 아직 없을 때 가짜 응답으로 화면만 테스트해요.
// 백엔드에 POST /rooms/:id/schedules 가 올라오면 false로 바꿔요.
const USE_MOCK_SCHEDULES = true;

// true: POST /rooms/:id/schedules/parse (캡처 분석)가 서버에 없을 때 가짜 응답을 써요.
const USE_MOCK_PARSE = true;

// 업로드 제한 (서버에서도 다시 확인해요)
const MAX_IMAGE_MB = 5;
const IMAGE_TYPES = ["image/png", "image/jpeg"];

// 시간표 JSON 필드 이름 (팀 합의 후 여기서 바꿔요)
//   { nickname, preferredTimes: ["오후"], classes: [{ day, start, end, room }] }
const DAYS = ["월", "화", "수", "목", "금", "토"];
const PREFERRED_TIMES = ["오전", "오후", "저녁"];

// 시간표 캡처 이미지를 보내 수업 목록을 받아요. (서버가 LLM으로 분석, 저장은 안 함)
// 성공 시 data.classes = [{ day, start, end, room }]
async function parseSchedule(roomId, file) {
  if (USE_MOCK_PARSE) {
    await new Promise((resolve) => setTimeout(resolve, 800)); // 분석 중인 척
    return {
      ok: true,
      data: {
        classes: [
          { day: "월", start: "10:30", end: "12:00", room: "한울관 301" },
          { day: "수", start: "13:00", end: "14:30", room: "새빛관 205" },
        ],
      },
    };
  }
  const form = new FormData();
  form.append("image", file); // 필드 이름 "image"는 백엔드와 합의 필요
  const res = await fetch(`${API}/rooms/${roomId}/schedules/parse`, {
    method: "POST",
    body: form,
  });
  return { ok: res.ok, data: await res.json() };
}

async function saveSchedule(roomId, payload) {
  if (USE_MOCK_SCHEDULES) {
    // 가짜 응답: 서버가 수정 토큰을 발급해 준다고 가정
    return { ok: true, data: { scheduleId: "mock-" + Date.now(), editToken: "mock-token" } };
  }
  const res = await fetch(`${API}/rooms/${roomId}/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, data: await res.json() };
}
