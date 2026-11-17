// 서버와의 통신 코드를 한 파일에 모은다.
// 백엔드 API가 바뀌면 이 파일만 수정하면 된다.

const API = "http://localhost:3000";

// true이면 시간표 저장 API(POST /rooms/:id/schedules)를 호출하지 않고 가짜 응답을 사용한다.
// 서버에 해당 API가 구현되면 false로 변경한다.
const USE_MOCK_SCHEDULES = false;

// true이면 캡처 분석 API(POST /rooms/:id/schedules/parse) 대신 가짜 응답을 사용한다.
const USE_MOCK_PARSE = true;

// 업로드 제한. 서버에서도 동일하게 검증해야 한다.
const MAX_IMAGE_MB = 5;
const IMAGE_TYPES = ["image/png", "image/jpeg"];

// 시간표 JSON 형식 (필드 이름은 팀 합의 후 확정한다)
//   { nickname, preferredTimes: ["오후"], classes: [{ day, start, end, room }] }
const DAYS = ["월", "화", "수", "목", "금"];
const PREFERRED_TIMES = ["오전", "오후", "저녁"];

// 시간표 캡처 이미지를 서버로 보내 수업 목록을 받는다. 서버가 LLM으로 분석하며 결과를 저장하지는 않는다.
// 성공 시 data.classes = [{ day, start, end, room }]
async function parseSchedule(roomId, file) {
  if (USE_MOCK_PARSE) {
    await new Promise((resolve) => setTimeout(resolve, 800)); // 분석에 걸리는 시간을 흉내 내는 지연
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
  form.append("image", file); // 파일 필드 이름 "image"는 백엔드와 합의가 필요하다
  const res = await fetch(`${API}/rooms/${roomId}/schedules/parse`, {
    method: "POST",
    body: form,
  });
  return { ok: res.ok, data: await res.json() };
}

async function saveSchedule(roomId, payload) {
  if (USE_MOCK_SCHEDULES) {
    // 서버가 수정 토큰을 발급한다고 가정한 가짜 응답
    return { ok: true, data: { scheduleId: "mock-" + Date.now(), editToken: "mock-token" } };
  }
  const res = await fetch(`${API}/rooms/${roomId}/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, data: await res.json() };
}
