// 일반 모드 일정 격자: 바쁜 시간을 드래그로 칠한다. (학생 모드 시간표 격자에서 강의실 입력을 뺀 버전)
// 사용법: const grid = createBusyGrid(element, { days, startH, endH, onChange });
//         grid.get() → [{ day, start, end }], grid.set(list)

function createBusyGrid(root, { days, startH = 9, endH = 23, hourPx = 36, step = 30, onChange = () => {} }) {
  let items = [];
  let selected = -1;

  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const toTime = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  const minToPx = (m) => ((m - startH * 60) / 60) * hourPx;

  // 격자 뼈대와 고치기 영역을 만든다
  const bodyHeight = (endH - startH) * hourPx;
  root.innerHTML = `
    <div class="tt" style="--hour:${hourPx}px; --days:${days.length}">
      <div class="tt-corner"></div>
      ${days.map((d) => `<div class="tt-head">${d}</div>`).join("")}
      <div class="tt-times" style="height:${bodyHeight}px">
        ${Array.from({ length: endH - startH }, (_, i) => `<span style="top:${i * hourPx}px">${startH + i}</span>`).join("")}
      </div>
      ${days.map((d) => `<div class="tt-col" data-day="${d}" style="height:${bodyHeight}px"></div>`).join("")}
    </div>
    <div class="editor" hidden>
      <div class="editor-head"><span>선택한 일정</span><button class="btn btn-text btn-sm" type="button" data-act="close">완료</button></div>
      <div class="editor-grid">
        <select aria-label="요일">${days.map((d) => `<option>${d}</option>`).join("")}</select>
        <input type="time" step="600" aria-label="시작 시각" />
        <input type="time" step="600" aria-label="끝 시각" />
      </div>
      <div class="editor-actions"><span></span><button class="btn btn-danger-text btn-sm" type="button" data-act="delete">이 일정 지우기</button></div>
    </div>`;

  const cols = [...root.querySelectorAll(".tt-col")];
  const editor = root.querySelector(".editor");
  const [edDay] = editor.querySelectorAll("select");
  const [edStart, edEnd] = editor.querySelectorAll("input");

  function render() {
    cols.forEach((c) => c.querySelectorAll(".block").forEach((b) => b.remove()));
    items.forEach((it, i) => {
      const col = cols.find((c) => c.dataset.day === it.day);
      if (!col || !it.start || !it.end) return;
      const top = Math.max(0, minToPx(toMin(it.start)));
      const b = document.createElement("div");
      b.className = "block busy" + (i === selected ? " selected" : "");
      b.style.top = top + "px";
      b.style.height = Math.max(14, minToPx(toMin(it.end)) - top) + "px";
      b.textContent = "바쁨";
      const time = document.createElement("small");
      time.textContent = it.start + "~" + it.end;
      b.appendChild(time);
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
      b.addEventListener("click", () => select(i));
      col.appendChild(b);
    });
    onChange(items);
  }

  function select(i) {
    selected = i;
    editor.hidden = i < 0;
    if (i >= 0) {
      edDay.value = items[i].day; edStart.value = items[i].start; edEnd.value = items[i].end;
    }
    render();
  }

  [edDay, edStart, edEnd].forEach((el) => el.addEventListener("input", () => {
    if (selected < 0) return;
    items[selected] = { day: edDay.value, start: edStart.value, end: edEnd.value };
    render();
  }));
  editor.querySelector("[data-act=close]").addEventListener("click", () => select(-1));
  editor.querySelector("[data-act=delete]").addEventListener("click", () => {
    items.splice(selected, 1);
    select(-1);
  });

  // 빈 칸을 누르거나 드래그하면 바쁜 시간이 생긴다. 한 번 누르면 1시간짜리
  let drag = null;
  const slotAt = (col, y) => {
    const min = startH * 60 + Math.floor((y - col.getBoundingClientRect().top) / hourPx * 60 / step) * step;
    return Math.min(Math.max(min, startH * 60), endH * 60 - step);
  };
  const drawGhost = () => {
    drag.ghost.style.top = minToPx(drag.lo) + "px";
    drag.ghost.style.height = minToPx(drag.hi) - minToPx(drag.lo) + "px";
  };

  cols.forEach((col) => {
    col.addEventListener("pointerdown", (e) => {
      if (e.target !== col) return;
      col.setPointerCapture(e.pointerId);
      const s = slotAt(col, e.clientY);
      const ghost = document.createElement("div");
      ghost.className = "ghost";
      col.appendChild(ghost);
      drag = { col, anchor: s, lo: s, hi: s + step, ghost, moved: false };
      drawGhost();
    });
    col.addEventListener("pointermove", (e) => {
      if (!drag || drag.col !== col) return;
      const cur = slotAt(col, e.clientY);
      if (cur !== drag.anchor) drag.moved = true;
      drag.lo = Math.min(drag.anchor, cur);
      drag.hi = Math.max(drag.anchor, cur) + step;
      drawGhost();
    });
    col.addEventListener("pointerup", () => {
      if (!drag || drag.col !== col) return;
      drag.ghost.remove();
      const hi = drag.moved ? drag.hi : Math.min(drag.lo + 60, endH * 60);
      items.push({ day: col.dataset.day, start: toTime(drag.lo), end: toTime(hi) });
      drag = null;
      select(-1);
    });
    col.addEventListener("pointercancel", () => {
      if (drag) { drag.ghost.remove(); drag = null; }
    });
  });

  render();

  return {
    get: () => items.map((it) => ({ ...it })),
    set: (list) => { items = list.map((it) => ({ ...it })); select(-1); },
  };
}
