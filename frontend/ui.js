// 여러 화면이 함께 쓰는 화면 도우미 함수를 모은다. (서버 통신은 api.js)

// 화면 아래에 짧은 알림을 잠깐 띄운다
function showToast(message) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

// 닉네임마다 항상 같은 색을 고른다
const AVATAR_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6", "#ef4444", "#14b8a6"];
function avatarColor(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// 마지막으로 쓴 닉네임을 기억해 다음 방에서 미리 채운다
function loadLastNickname() {
  try {
    return localStorage.getItem("lastNickname") || "";
  } catch (e) {
    return "";
  }
}

function storeLastNickname(nickname) {
  try {
    localStorage.setItem("lastNickname", nickname);
  } catch (e) { /* 기억하지 못해도 동작에는 문제없다 */ }
}

// ===== 내 기본 시간표 =====
// 시간표는 잘 바뀌지 않으므로 한 번 넣어 두고 방에 들어갈 때마다 자동으로 채운다.
// 로그인이 없으므로 서버가 아니라 이 브라우저에만 저장한다.
//   student: { nickname, classes: [{ day, start, end, room }], preferredTimes }
//   general: { nickname, stationId, busy: [{ day, start, end }] | null, preferredTimes }
function loadMyProfile(mode) {
  try {
    return JSON.parse(localStorage.getItem(`myProfile:${mode}`));
  } catch (e) {
    return null;
  }
}

function storeMyProfile(mode, profile) {
  try {
    localStorage.setItem(`myProfile:${mode}`, JSON.stringify({ ...profile, savedAt: Date.now() }));
    return true;
  } catch (e) {
    return false;
  }
}
