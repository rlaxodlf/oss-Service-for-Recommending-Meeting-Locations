// 서버와의 통신 코드를 한 파일에 모은다.
// 백엔드 API가 바뀌면 이 파일만 수정하면 된다.

// 백엔드 서버 주소. 배포할 때는 이 한 줄만 바꾼다.
const API = "http://localhost:3000";

// true이면 시간표 저장 API(POST /rooms/:id/schedules)를 호출하지 않고 가짜 응답을 사용한다.
// 서버에 해당 API가 구현되면 false로 변경한다.
const USE_MOCK_SCHEDULES = false;

// true이면 캡처 분석 API(POST /rooms/:id/schedules/parse) 대신 가짜 응답을 사용한다.
// 서버에 해당 API가 구현되면 false로 변경한다.
const USE_MOCK_PARSE = true;

// 업로드 제한. 서버에서도 동일하게 검증해야 한다.
const MAX_IMAGE_MB = 5;
const IMAGE_TYPES = ["image/png", "image/jpeg"];

// 화면에서는 한글 요일·시간대를 쓰고, 서버에는 영어 코드로 보낸다.
// 서버는 월~금만 받으므로 화면에도 토요일을 두지 않는다.
const DAYS = ["월", "화", "수", "목", "금"];
const DAY_CODES = { "월": "mon", "화": "tue", "수": "wed", "목": "thu", "금": "fri" };
const PREFERRED_TIMES = ["오전", "오후", "저녁"];
const PREFERRED_CODES = { "오전": "morning", "오후": "afternoon", "저녁": "evening" };

// 코드 → 한글 변환 (서버 응답을 화면에 보여 줄 때 사용)
const invert = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]));
const DAY_LABELS = invert(DAY_CODES);
const PREFERRED_LABELS = invert(PREFERRED_CODES);

// 화면 형식 { nickname, preferredTimes: ["오후"], classes: [{ day: "월", start, end, room }] }
// → 서버 형식 { nickname, preferred: ["afternoon"], classes: [{ day: "mon", start, end, building }] }
function toServerSchedule({ nickname, preferredTimes, classes }) {
  return {
    nickname,
    preferred: preferredTimes.map((t) => PREFERRED_CODES[t] ?? t),
    classes: classes.map((c) => ({
      day: DAY_CODES[c.day] ?? c.day,
      start: c.start,
      end: c.end,
      building: c.room,
    })),
  };
}

// 서버 형식의 시간표 → 화면 형식 (내 시간표를 다시 불러올 때 사용)
function fromServerSchedule(schedule) {
  return {
    nickname: schedule.nickname,
    preferredTimes: (schedule.preferred || []).map((p) => PREFERRED_LABELS[p] ?? p),
    classes: schedule.classes.map((c) => ({
      day: DAY_LABELS[c.day] ?? c.day,
      start: c.start,
      end: c.end,
      room: c.building,
    })),
  };
}

// 서버 오류 응답에서 화면에 보여 줄 문장을 만든다.
// 서버는 { error: "..." } 또는 검증 실패 시 { message, errors: [...] } 형식으로 보낸다.
function errorText(data, fallback = "요청을 처리하지 못했어요.") {
  if (data && Array.isArray(data.errors) && data.errors.length > 0) return data.errors.join("\n");
  return (data && (data.error || data.message)) || fallback;
}

// 공통 요청 함수. 응답 본문이 JSON이 아니어도 실패하지 않도록 처리한다.
async function request(path, options = {}) {
  const res = await fetch(API + path, options);
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

const jsonOptions = (method, body, headers = {}) => ({
  method,
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

// ===== 방 =====
function createRoom(name, minMinutes) {
  return request("/rooms", jsonOptions("POST", { name, minMinutes }));
}

function getRoom(roomId) {
  return request(`/rooms/${roomId}`);
}

// ===== 시간표 =====
function getSchedules(roomId) {
  return request(`/rooms/${roomId}/schedules`);
}

async function saveSchedule(roomId, payload) {
  if (USE_MOCK_SCHEDULES) {
    // 서버가 수정 토큰을 발급한다고 가정한 가짜 응답
    return { ok: true, status: 201, data: { scheduleId: "mock-" + Date.now(), editToken: "mock-token" } };
  }
  return request(`/rooms/${roomId}/schedules`, jsonOptions("POST", toServerSchedule(payload)));
}

function updateSchedule(roomId, scheduleId, editToken, payload) {
  return request(
    `/rooms/${roomId}/schedules/${scheduleId}`,
    jsonOptions("PATCH", toServerSchedule(payload), { "X-Edit-Token": editToken })
  );
}

function deleteSchedule(roomId, scheduleId, editToken) {
  return request(`/rooms/${roomId}/schedules/${scheduleId}`, {
    method: "DELETE",
    headers: { "X-Edit-Token": editToken },
  });
}

// ===== 공통 시간 추천 =====
function getRecommendations(roomId) {
  return request(`/rooms/${roomId}/recommendations`);
}

// ===== 시간표 캡처 분석 =====
// 시간표 캡처 이미지를 서버로 보내 수업 목록을 받는다. 서버가 LLM으로 분석하며 결과를 저장하지는 않는다.
// 성공 시 data.classes = [{ day, start, end, room }] (화면 형식)
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
  const result = await request(`/rooms/${roomId}/schedules/parse`, { method: "POST", body: form });
  if (result.ok && Array.isArray(result.data?.classes)) {
    result.data.classes = fromServerSchedule({ classes: result.data.classes }).classes;
  }
  return result;
}

// ===== 수정 토큰 =====
// 시간표를 등록한 브라우저에만 토큰이 남는다. localStorage를 쓸 수 없는 환경에서도 앱이 멈추지 않게 한다.
function loadEditToken(roomId) {
  try {
    return JSON.parse(localStorage.getItem(`editToken:${roomId}`));
  } catch (e) {
    return null;
  }
}

function storeEditToken(roomId, scheduleId, editToken) {
  try {
    localStorage.setItem(`editToken:${roomId}`, JSON.stringify({ scheduleId, editToken }));
  } catch (e) { /* 저장하지 못해도 등록 자체는 계속 진행한다 */ }
}

function clearEditToken(roomId) {
  try {
    localStorage.removeItem(`editToken:${roomId}`);
  } catch (e) { /* 무시 */ }
}
